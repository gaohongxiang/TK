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
  /<DecimalInput[\s\S]*value=\{value\}[\s\S]*onChange=\{nextValue => onChange\?\.\(nextValue\)\}[\s\S]*<Field id="costNew"[\s\S]*value=\{state\.costNew\}[\s\S]*updateNumber\('costNew', value\)/,
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
  /function syncCalculatedShipping\([\s\S]*finalShippingCost\(state\)[\s\S]*shippingSourceNew === 'manual'[\s\S]*overseasShippingNew: finalCost[\s\S]*shippingInputSignatureRef[\s\S]*useEffect\(\(\) => \{[\s\S]*syncCalculatedShipping\(previous,\s*\{\s*force\s*\}\)[\s\S]*state\.shipActualWeightNew[\s\S]*state\.labelFeeNew/,
  '海外运费计算器结果需要自动回填；用户手动改值后保留，运费参数变化时再用新计算值覆盖'
);

assert.match(
  calculatorSource,
  /<Field id="creatorRateNew"[\s\S]*value=\{state\.creatorRateNew\}[\s\S]*updateNumber\('creatorRateNew', value\)[\s\S]*<Field id="creatorRateReview"[\s\S]*value=\{state\.creatorRateNew\}[\s\S]*updateNumber\('creatorRateNew', value\)/,
  '定价新和利润复盘达人佣金率需要共用 creatorRateNew 状态'
);

assert.match(
  calculatorSource,
  /<Field id="creatorRateReview"[\s\S]*inputClassName="min-h-\[48px\] text-\[18px\]/,
  '利润复盘达人佣金率输入框需要和同组重点输入框保持一致高度'
);

console.log('calc react state sync ok');
