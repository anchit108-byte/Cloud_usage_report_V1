import { createHash } from 'node:crypto';
import type { ParsedCsv } from './csvParser';
import type { ValidationResult } from '../types/cloud';

export function computeFileHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function validateCsvInput(
  filename: string,
  rawText: string,
  parsed: ParsedCsv
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fileHash = computeFileHash(rawText);

  if (!filename.toLowerCase().endsWith('.csv')) {
    warnings.push('File extension is not .csv; attempting CSV parsing based on text structure.');
  }

  if (!rawText.trim()) {
    errors.push('Uploaded file is empty. Provide a CSV file with a header row and at least one data row.');
  } else if (parsed.headers.length === 0) {
    errors.push('No header row could be detected in the uploaded CSV.');
  } else if (parsed.rows.length === 0) {
    errors.push('CSV contains headers but zero non-empty data rows.');
  }

  if (parsed.headers.length === 1 && parsed.rows.length > 0) {
    warnings.push('Only 1 column detected. Verify that the CSV uses comma, semicolon, or tab delimiters.');
  }

  if (parsed.rows.length > 50000) {
    errors.push('CSV exceeds the 50,000-row single-upload limit.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rowCount: parsed.rows.length,
    columnCount: parsed.headers.length,
    headers: parsed.headers,
    fileHash,
  };
}
