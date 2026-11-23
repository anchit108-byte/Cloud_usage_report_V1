import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { runNumericalAnalytics } from './src/lib/analytics';
import { detectColumns } from './src/lib/columnDetector';
import { parseCsvText } from './src/lib/csvParser';
import { validateCsvInput } from './src/lib/csvValidator';
import { CloudDatabase } from './src/lib/database';
import { cleanAndNormalizeRows } from './src/lib/dataCleaner';
import { evaluateMlForecastAvailability } from './src/lib/mlModel';
import { generateRecommendations } from './src/lib/recommendationEngine';
import { generateOptimizationReport } from './src/lib/reportGenerator';

const PORT = Number(process.env.PORT || 3000);
const db = new CloudDatabase();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', database: 'sqlite', historyCount: db.listHistory().length });
  });

  app.get('/api/history', (_req, res) => {
    try {
      const items = db.listHistory();
      res.json({ items });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load upload history.',
      });
    }
  });

  app.get('/api/reports/latest', (_req, res) => {
    try {
      const report = db.getLatestReport();
      res.json({ report });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load latest report.',
      });
    }
  });

  app.get('/api/reports/:id', (req, res) => {
    try {
      const report = db.getReportById(req.params.id);
      if (!report) {
        res.status(404).json({ error: 'Report not found.' });
        return;
      }
      res.json({ report });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load report.',
      });
    }
  });

  app.delete('/api/uploads/:id', (req, res) => {
    try {
      const deleted = db.deleteUpload(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Upload record not found.' });
        return;
      }
      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to delete upload.',
      });
    }
  });

  app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No CSV file provided in multipart field "file".' });
        return;
      }

      const filename = req.file.originalname || 'uploaded.csv';
      const rawText = req.file.buffer.toString('utf8');

      // 1. Parse + Validate CSV
      const parsed = parseCsvText(rawText);
      const validation = validateCsvInput(filename, rawText, parsed);
      if (!validation.valid) {
        res.status(422).json({
          error: validation.errors.join(' '),
          validation,
        });
        return;
      }

      // Prevent duplicate historical record inflation
      const existing = db.findUploadByHash(validation.fileHash);
      if (existing) {
        const existingReport = db.getReportById(existing.reportId);
        if (existingReport) {
          res.status(200).json({
            duplicateDetected: true,
            message: `Identical file "${existing.filename}" was previously analyzed on ${new Date(existing.uploadedAt).toLocaleString()}. Loaded persisted report without duplicating historical records.`,
            report: existingReport,
          });
          return;
        }
      }

      // 2. Automatic Column Detection
      const detection = detectColumns(parsed.headers, parsed.rows);

      // 3. Data Cleaning & Normalization
      const cleaningResult = cleanAndNormalizeRows(parsed.rows, detection.metricToHeader);
      if (cleaningResult.records.length === 0) {
        res.status(422).json({
          error: 'After cleaning empty/duplicate rows, no usable records remained in the CSV.',
          validation,
        });
        return;
      }

      // 4. Numerical Analysis (including historical DB records for multi-year YoY comparison)
      const priorHistoricalRecords = db.getHistoricalRecords();
      const combinedHistoricalRecords = [...priorHistoricalRecords, ...cleaningResult.records];
      const analytics = runNumericalAnalytics(
        cleaningResult.records,
        combinedHistoricalRecords,
        detection.detectedColumns
      );

      // 5. ML Model Interface (no fabricated predictions)
      const mlStatus = evaluateMlForecastAvailability(analytics);

      // 6. Recommendation Engine
      const recommendations = generateRecommendations(cleaningResult.records);

      // 7. Report Generation
      const uploadId = randomUUID();
      const report = generateOptimizationReport({
        uploadId,
        filename,
        validation,
        cleaning: cleaningResult.summary,
        detection,
        analytics,
        mlStatus,
        recommendations,
      });

      // 8. SQLite Persistence
      db.saveAnalysis(uploadId, report, cleaningResult.records);

      res.status(201).json({
        duplicateDetected: false,
        report,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unexpected processing error.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CloudOptix server listening on http://localhost:${PORT}`);
  });
}

startServer();
