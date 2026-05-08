import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const calculatorSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'calculator', 'CalculatorApp.tsx'), 'utf8');

assert.ok(!fs.existsSync(path.join(root, 'src', 'calc', 'pricing.mjs')), '完整 React SPA 后不应保留旧 calc pricing DOM 壳层');

assert.match(
  calculatorSource,
  /const totalCost = state\.costNew \+ state\.overseasShippingNew/,
  'React 利润计算器需要用同一份 costNew / overseasShippingNew 状态计算定价新和利润复盘总费用'
);

assert.match(
  calculatorSource,
  /<Field id="costNew"[\s\S]*value=\{state\.costNew\}[\s\S]*updateNumber\('costNew', value\)/,
  '定价新采购价输入需要直接写入共享 costNew 状态'
);

assert.match(
  calculatorSource,
  /<Field id="costReview"[\s\S]*value=\{state\.costNew\}[\s\S]*updateNumber\('costNew', value\)/,
  '利润复盘采购价输入需要直接写入共享 costNew 状态'
);

assert.match(
  calculatorSource,
  /<Field id="overseasShippingNew"[\s\S]*value=\{state\.overseasShippingNew\}[\s\S]*updateNumber\('overseasShippingNew', value\)/,
  '定价新海外运费输入需要直接写入共享 overseasShippingNew 状态'
);

assert.match(
  calculatorSource,
  /<Field id="shippingReview"[\s\S]*value=\{state\.overseasShippingNew\}[\s\S]*updateNumber\('overseasShippingNew', value\)/,
  '利润复盘海外运费输入需要直接写入共享 overseasShippingNew 状态'
);

assert.match(
  calculatorSource,
  /<Field id="creatorRateNew"[\s\S]*value=\{state\.creatorRateNew\}[\s\S]*updateNumber\('creatorRateNew', value\)[\s\S]*<Field id="creatorRateReview"[\s\S]*value=\{state\.creatorRateNew\}[\s\S]*updateNumber\('creatorRateNew', value\)/,
  '定价新和利润复盘达人佣金率需要共用 creatorRateNew 状态'
);

console.log('calc react state sync ok');
