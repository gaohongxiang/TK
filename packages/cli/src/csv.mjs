import fs from 'node:fs/promises';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (char !== '\r') cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function readCsv(file) {
  const text = await fs.readFile(file, 'utf8');
  const rows = parseCsv(text);
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map(value => String(value || '').trim());
  return {
    headers,
    rows: rows.slice(1)
      .filter(values => values.some(value => String(value || '').trim()))
      .map(values => Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? '')])))
  };
}

async function readCsvIfExists(file) {
  try {
    return await readCsv(file);
  } catch {
    return { headers: [], rows: [] };
  }
}

export {
  parseCsv,
  readCsv,
  readCsvIfExists
};
