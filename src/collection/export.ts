import type { CsvRow } from './table.ts';

type CollectionDataset = {
  filename: string;
  headers: string[];
  rows: CsvRow[];
};

function csvCell(value: unknown) {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function stringifyCollectionCsv(headers: string[] = [], rows: CsvRow[] = [], { includeBom = false } = {}) {
  const csv = [
    headers.map(csvCell).join(','),
    ...rows.map(row => headers.map(header => csvCell(row[header] || '')).join(','))
  ].join('\r\n');
  return includeBom ? `\uFEFF${csv}` : csv;
}

function filterCollectionRowsByAccounts(rows: CsvRow[] = [], selectedAccounts: Set<string> = new Set()) {
  if (!selectedAccounts.size) return [];
  return rows.filter(row => selectedAccounts.has(String(row?.['账号'] || '').trim()));
}

function buildCollectionExportFile(dataset: CollectionDataset | null | undefined, selectedAccounts: Set<string>) {
  if (!dataset?.rows?.length) return null;
  const rows = filterCollectionRowsByAccounts(dataset.rows, selectedAccounts);
  if (!rows.length) return null;
  const baseName = dataset.filename.replace(/\.csv$/i, '') || 'collection_records';
  return {
    filename: `${baseName}.edited.csv`,
    csv: stringifyCollectionCsv(dataset.headers, rows, { includeBom: true }),
    count: rows.length
  };
}

export {
  buildCollectionExportFile,
  csvCell,
  filterCollectionRowsByAccounts,
  stringifyCollectionCsv
};
export type { CollectionDataset };
