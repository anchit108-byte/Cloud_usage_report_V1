export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  rawRowCount: number;
}

/**
 * Parses CSV text handling UTF-8 BOM, CRLF/LF line endings, quoted fields,
 * escaped quotes (""), and auto-detected delimiter (comma, semicolon, or tab).
 */
export function parseCsvText(csvText: string): ParsedCsv {
  const cleaned = csvText.replace(/^\uFEFF/, '');
  if (!cleaned.trim()) {
    return { headers: [], rows: [], rawRowCount: 0 };
  }

  const delimiter = detectDelimiter(cleaned);
  const matrix = parseCsvMatrix(cleaned, delimiter);

  if (matrix.length === 0) {
    return { headers: [], rows: [], rawRowCount: 0 };
  }

  const rawHeaders = matrix[0].map((h, idx) => {
    const trimmed = h.trim();
    return trimmed.length > 0 ? trimmed : `column_${idx + 1}`;
  });

  // Deduplicate identical header names deterministically
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h) => {
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h}_${count + 1}`;
  });

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const rowValues = matrix[i];
    const hasAnyContent = rowValues.some((cell) => cell.trim().length > 0);
    if (!hasAnyContent) {
      continue;
    }
    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = (rowValues[c] ?? '').trim();
    }
    rows.push(rowObj);
  }

  return {
    headers,
    rows,
    rawRowCount: Math.max(0, matrix.length - 1),
  };
}

function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n');
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestScore = -1;

  for (const delim of candidates) {
    let inQuotes = false;
    let count = 0;
    for (let i = 0; i < firstLines.length; i++) {
      const ch = firstLines[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && ch === delim) {
        count++;
      }
    }
    if (count > bestScore) {
      bestScore = count;
      best = delim;
    }
  }
  return best;
}

function parseCsvMatrix(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else if (ch === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}
