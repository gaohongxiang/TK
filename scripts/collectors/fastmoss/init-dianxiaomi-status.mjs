import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await fs.readFile(path.join(scriptDir, 'config.json'), 'utf8'));
const outputRoot = path.resolve(root, config.outputDir || 'data/collection/fastmoss/runs');
const args = parseArgs(process.argv.slice(2));
const inputPath = args.inputPath
  ? path.resolve(root, args.inputPath)
  : await latestCandidatesFile(outputRoot);

if (!inputPath) {
  console.error('没有找到 selection_candidates.json，请先执行 select-fastmoss-products.mjs。');
  process.exit(1);
}

const outDir = path.dirname(inputPath);
const candidates = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const accountName = normalizeAccountOption(args.account || process.env.TK_COLLECTION_ACCOUNT || firstAccount(candidates));
if (!accountName) {
  console.error('缺少目标账号：请使用 --account <账号名>，例如 --account NOMA。');
  process.exit(1);
}
const rows = Array.isArray(candidates)
  ? candidates.map((candidate) => formatRow(candidate, accountName)).filter(Boolean)
  : [];
const outputPath = path.join(outDir, 'collection_records.csv');

await writeCsv(outputPath, rows, [
  '账号',
  '商品ID',
  '商品名称',
  '店铺名',
  '商品价格',
  '商品近7天销量',
  '采集时间',
  '采集状态',
  '选品判断',
  '商品链接',
  'FastMoss 链接'
]);

console.log(`输入文件：${inputPath}`);
console.log(`可写采集记录数：${rows.length}`);
console.log(`目标账号：${accountName}`);
console.log(`采集表：${outputPath}`);

function parseArgs(argv) {
  const options = { inputPath: '', account: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--account') {
      options.account = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg.startsWith('--account=')) {
      options.account = arg.slice('--account='.length);
      continue;
    }
    if (!arg.startsWith('--') && !options.inputPath) options.inputPath = arg;
  }
  return options;
}

function normalizeAccountOption(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '【账号名】') return '';
  return text;
}

function firstAccount(records) {
  if (!Array.isArray(records)) return '';
  for (const record of records) {
    const account = normalizeAccountOption(record?.['账号'] || record?.account || record?.accountName || record?.account_name);
    if (account) return account;
  }
  return '';
}

async function latestCandidatesFile(runsDir) {
  try {
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
    for (const dir of dirs) {
      const candidate = path.join(runsDir, dir, 'selection_candidates.json');
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // 继续检查下一个运行目录。
      }
    }
  } catch {
    return null;
  }
  return null;
}

function formatRow(candidate, targetAccount) {
  const status = normalizeCollectStatus(candidate['采集状态'] || candidate.collect_status || candidate.collectStatus);
  if (!status) return null;
  const judgement = String(candidate['选品判断'] || candidate.selection_judgement || candidate.selectionJudgement || '').trim();
  if (status === '采集失败' && !judgement) return null;
  return {
    '账号': candidate['账号'] || candidate.account || candidate.accountName || targetAccount,
    '商品ID': candidate['商品ID'] || candidate.product_id || candidate.item_id || '',
    '商品名称': candidate['商品名称'] || '',
    '店铺名': candidate['店铺名'] || candidate.shop_name || '',
    '商品价格': candidate['商品价格'] || candidate.product_price || '',
    '商品近7天销量': candidate['商品近7天销量'] || candidate['商品近 7 天销量'] || candidate.day7_sales || candidate.day7_sold_count || '',
    '采集时间': candidate['采集时间'] || candidate.collected_at || candidate.collectedAt || new Date().toISOString(),
    '采集状态': status,
    '选品判断': judgement || '符合当前选品规则，已采集到店小秘。',
    '商品链接': candidate['商品链接'] || candidate.product_url || '',
    'FastMoss 链接': candidate['FastMoss 链接'] || candidate.fastmoss_url || candidate['店铺链接'] || candidate.shop_url || ''
  };
}

function normalizeCollectStatus(value) {
  const text = String(value || '').trim();
  if (text === '已采集') return '已采集';
  if (text === '采集失败') return '采集失败';
  return '';
}

async function writeCsv(file, records, headers) {
  const lines = [
    headers.join(','),
    ...records.map((record) => headers.map((header) => csvCell(record[header])).join(','))
  ];
  await fs.writeFile(file, lines.join('\n'));
}

function csvCell(value) {
  if (value === undefined || value === null) return '';
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
