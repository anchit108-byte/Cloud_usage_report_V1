import type {
  NormalizedRecord,
  RecommendationItem,
} from '../types/cloud';

interface ResourceAggregate {
  key: string;
  resourceId: string;
  service: string | null;
  region: string | null;
  resourceType: string | null;
  records: NormalizedRecord[];
  totalCost: number | null;
  avgCpu: number | null;
  peakCpu: number | null;
  avgRam: number | null;
  peakRam: number | null;
  avgStorage: number | null;
  avgUptime: number | null;
  avgIops: number | null;
  totalUsage: number | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function avg(arr: number[]): number | null {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

export function generateRecommendations(records: NormalizedRecord[]): RecommendationItem[] {
  if (records.length === 0) return [];

  const hasResourceId = records.some((r) => r.resourceId !== null);
  const grouped = new Map<string, NormalizedRecord[]>();

  records.forEach((r, idx) => {
    const key = hasResourceId
      ? r.resourceId || `Unidentified-${r.service || 'Resource'}-${idx + 1}`
      : r.service
        ? `${r.service}${r.region ? ` (${r.region})` : ''}`
        : `Record-${idx + 1}`;
    const list = grouped.get(key) ?? [];
    list.push(r);
    grouped.set(key, list);
  });

  const aggregates: ResourceAggregate[] = Array.from(grouped.entries()).map(([key, recs]) => {
    const costs = recs.map((r) => r.cost).filter((v): v is number => v !== null);
    const cpus = recs.map((r) => r.cpu).filter((v): v is number => v !== null);
    const rams = recs.map((r) => r.ram).filter((v): v is number => v !== null);
    const storages = recs.map((r) => r.storage).filter((v): v is number => v !== null);
    const uptimes = recs.map((r) => r.uptime).filter((v): v is number => v !== null);
    const iopsList = recs.map((r) => r.iops).filter((v): v is number => v !== null);
    const usages = recs.map((r) => r.usage).filter((v): v is number => v !== null);

    return {
      key,
      resourceId: hasResourceId ? key : recs[0].resourceId ?? key,
      service: recs.find((r) => r.service)?.service ?? null,
      region: recs.find((r) => r.region)?.region ?? null,
      resourceType: recs.find((r) => r.resourceType)?.resourceType ?? null,
      records: recs,
      totalCost: costs.length > 0 ? round2(costs.reduce((a, b) => a + b, 0)) : null,
      avgCpu: avg(cpus) !== null ? round2(avg(cpus)!) : null,
      peakCpu: cpus.length > 0 ? round2(Math.max(...cpus)) : null,
      avgRam: avg(rams) !== null ? round2(avg(rams)!) : null,
      peakRam: rams.length > 0 ? round2(Math.max(...rams)) : null,
      avgStorage: avg(storages) !== null ? round2(avg(storages)!) : null,
      avgUptime: avg(uptimes) !== null ? round2(avg(uptimes)!) : null,
      avgIops: avg(iopsList) !== null ? round2(avg(iopsList)!) : null,
      totalUsage: usages.length > 0 ? round2(usages.reduce((a, b) => a + b, 0)) : null,
    };
  });

  const recommendations: RecommendationItem[] = [];

  for (const agg of aggregates) {
    const metrics: Record<string, string | number> = {
      observations: agg.records.length,
    };
    if (agg.totalCost !== null) metrics['Observed Cost ($)'] = agg.totalCost;
    if (agg.avgCpu !== null) metrics['Avg CPU (%)'] = agg.avgCpu;
    if (agg.peakCpu !== null) metrics['Peak CPU (%)'] = agg.peakCpu;
    if (agg.avgRam !== null) metrics['Avg RAM (%)'] = agg.avgRam;
    if (agg.peakRam !== null) metrics['Peak RAM (%)'] = agg.peakRam;
    if (agg.avgStorage !== null) metrics['Avg Storage (GB)'] = agg.avgStorage;
    if (agg.avgUptime !== null) metrics['Avg Uptime (%)'] = agg.avgUptime;
    if (agg.avgIops !== null) metrics['Avg IOPS'] = agg.avgIops;
    if (agg.totalUsage !== null) metrics['Total Usage'] = agg.totalUsage;

    // 1. Check DISCONTINUE — strictly requires strong multi-signal or explicit idle evidence
    const hasIdleComputeEvidence =
      agg.avgCpu !== null &&
      agg.avgCpu < 10 &&
      (agg.peakCpu === null || agg.peakCpu < 15) &&
      (agg.avgRam === null || agg.avgRam < 20) &&
      (agg.records.length >= 2 || (agg.avgCpu < 5 && (agg.avgRam === null || agg.avgRam < 15)));

    const hasUnattachedStorageEvidence =
      agg.avgIops !== null &&
      agg.avgIops === 0 &&
      (agg.avgStorage !== null || (agg.service ?? '').toLowerCase().includes('ebs') || (agg.service ?? '').toLowerCase().includes('storage'));

    if (hasUnattachedStorageEvidence) {
      recommendations.push({
        id: `rec-${recommendations.length + 1}`,
        classification: 'DISCONTINUE',
        resourceId: agg.resourceId,
        service: agg.service,
        region: agg.region,
        reason: `Storage resource shows zero IOPS activity across ${agg.records.length} observation(s), indicating an unattached or unused volume.`,
        supportingMetrics: metrics,
        suggestedAction: 'Create a final archival snapshot and delete the unattached storage volume.',
        estimatedMonthlySavings: agg.totalCost !== null ? round2(agg.totalCost) : null,
        savingsBasis:
          agg.totalCost !== null
            ? '100% of observed volume cost'
            : 'Not calculable (cost metric unavailable)',
      });
      continue;
    }

    if (hasIdleComputeEvidence) {
      recommendations.push({
        id: `rec-${recommendations.length + 1}`,
        classification: 'DISCONTINUE',
        resourceId: agg.resourceId,
        service: agg.service,
        region: agg.region,
        reason: `Idle compute utilization detected: average CPU is ${agg.avgCpu}%${agg.avgRam !== null ? ` and average RAM is ${agg.avgRam}%` : ''} across ${agg.records.length} observation(s).`,
        supportingMetrics: metrics,
        suggestedAction: 'Verify workload ownership, then terminate or schedule automatic shutdown.',
        estimatedMonthlySavings: agg.totalCost !== null ? round2(agg.totalCost * 0.85) : null,
        savingsBasis:
          agg.totalCost !== null
            ? 'Conservative 85% of observed spend upon termination/auto-stop'
            : 'Not calculable (cost metric unavailable)',
      });
      continue;
    }

    // 2. Check OPTIMIZE — underutilized / oversized or steady-state reservation candidate
    const isOverProvisioned =
      (agg.avgCpu !== null && agg.avgCpu < 30 && (agg.avgRam === null || agg.avgRam < 35)) ||
      (agg.avgRam !== null && agg.avgRam < 25 && (agg.avgCpu === null || agg.avgCpu < 35));

    const isSteadyStateReservationCandidate =
      agg.avgUptime !== null && agg.avgUptime > 80 && (agg.avgCpu === null || agg.avgCpu >= 30);

    if (isOverProvisioned) {
      recommendations.push({
        id: `rec-${recommendations.length + 1}`,
        classification: 'OPTIMIZE',
        resourceId: agg.resourceId,
        service: agg.service,
        region: agg.region,
        reason: `Resource appears over-provisioned: ${agg.avgCpu !== null ? `Avg CPU ${agg.avgCpu}%` : ''}${agg.avgCpu !== null && agg.avgRam !== null ? ', ' : ''}${agg.avgRam !== null ? `Avg RAM ${agg.avgRam}%` : ''} sits below the 30% utilization efficiency threshold.`,
        supportingMetrics: metrics,
        suggestedAction: 'Downsize to a smaller instance family/tier or enable auto-scaling.',
        estimatedMonthlySavings: agg.totalCost !== null ? round2(agg.totalCost * 0.35) : null,
        savingsBasis:
          agg.totalCost !== null
            ? 'Conservative 35% rightsizing reduction from observed spend'
            : 'Not calculable (cost metric unavailable)',
      });
      continue;
    }

    if (isSteadyStateReservationCandidate) {
      recommendations.push({
        id: `rec-${recommendations.length + 1}`,
        classification: 'OPTIMIZE',
        resourceId: agg.resourceId,
        service: agg.service,
        region: agg.region,
        reason: `Steady-state workload detected with ${agg.avgUptime}% average uptime, making on-demand pricing suboptimal.`,
        supportingMetrics: metrics,
        suggestedAction: 'Convert on-demand capacity to 1-year Reserved Instances or a Compute Savings Plan.',
        estimatedMonthlySavings: agg.totalCost !== null ? round2(agg.totalCost * 0.28) : null,
        savingsBasis:
          agg.totalCost !== null
            ? 'Conservative 28% Reserved Instance / Savings Plan discount'
            : 'Not calculable (cost metric unavailable)',
      });
      continue;
    }

    // 3. Otherwise CONTINUE — either healthy utilization or insufficient telemetry to flag waste
    const hasUtilizationTelemetry = agg.avgCpu !== null || agg.avgRam !== null || agg.avgIops !== null;
    const reason = hasUtilizationTelemetry
      ? `Resource utilization appears balanced (${agg.avgCpu !== null ? `Avg CPU ${agg.avgCpu}%` : ''}${agg.avgCpu !== null && agg.avgRam !== null ? ', ' : ''}${agg.avgRam !== null ? `Avg RAM ${agg.avgRam}%` : ''}) with no idle or oversizing triggers.`
      : 'Insufficient utilization telemetry (CPU/RAM/IOPS unavailable) to justify downsizing or discontinuation; maintain current state and collect telemetry.';

    recommendations.push({
      id: `rec-${recommendations.length + 1}`,
      classification: 'CONTINUE',
      resourceId: agg.resourceId,
      service: agg.service,
      region: agg.region,
      reason,
      supportingMetrics: metrics,
      suggestedAction: hasUtilizationTelemetry
        ? 'Continue current provisioning and monitor for seasonal load shifts.'
        : 'Continue monitoring; attach CPU/RAM utilization metrics for rightsizing evaluation.',
      estimatedMonthlySavings: null,
      savingsBasis: 'No waste detected',
    });
  }

  // Sort: DISCONTINUE first, then OPTIMIZE, then CONTINUE, ordered by highest savings/cost
  const priority: Record<RecommendationItem['classification'], number> = {
    DISCONTINUE: 0,
    OPTIMIZE: 1,
    CONTINUE: 2,
  };
  return recommendations.sort((a, b) => {
    if (priority[a.classification] !== priority[b.classification]) {
      return priority[a.classification] - priority[b.classification];
    }
    return (b.estimatedMonthlySavings ?? 0) - (a.estimatedMonthlySavings ?? 0);
  });
}
