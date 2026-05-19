import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const mainSource = fs.readFileSync(path.join(root, 'packages', 'cli', 'src', 'main.mjs'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'packages', 'cli', 'src', 'firestore-config.mjs'), 'utf8');
const clientSource = fs.readFileSync(path.join(root, 'packages', 'cli', 'src', 'firestore-client.mjs'), 'utf8');
const accountsSource = fs.readFileSync(path.join(root, 'packages', 'cli', 'src', 'accounts.mjs'), 'utf8');
const syncSource = fs.readFileSync(path.join(root, 'packages', 'cli', 'src', 'collection-sync.mjs'), 'utf8');
const collectionDocsSource = fs.readFileSync(path.join(root, 'packages', 'cli', 'src', 'collection-docs.mjs'), 'utf8');
const docsSource = fs.readFileSync(path.join(root, 'docs', 'guide', 'collection.md'), 'utf8');
const skillSource = fs.readFileSync(path.join(root, 'skills', 'tk-product-selection', 'SKILL.md'), 'utf8');

assert.ok(
  packageJson.scripts.tk?.includes('node packages/cli/bin/tk.mjs'),
  'package.json 需要提供 npm run tk 入口'
);

for (const file of [
  'packages/cli/bin/tk.mjs',
  'packages/cli/src/main.mjs',
  'packages/cli/src/firestore-config.mjs',
  'packages/cli/src/firestore-client.mjs',
  'packages/cli/src/accounts.mjs',
  'packages/cli/src/collection-sync.mjs',
  'packages/cli/src/collection-docs.mjs',
  'packages/cli/src/csv.mjs'
]) {
  assert.ok(fs.existsSync(path.join(root, file)), `${file} 需要存在`);
}

assert.match(
  mainSource,
  /db setup[\s\S]*db status[\s\S]*accounts list[\s\S]*accounts check[\s\S]*collection preflight[\s\S]*collection sync[\s\S]*collection mark-dxm-edited/,
  'TK CLI 需要覆盖 db、accounts、collection 同步和店小秘编辑回写命令'
);

assert.match(
  configSource,
  /data\/tk-cli\/firestore-config\.json[\s\S]*TK_FIRESTORE_CONFIG[\s\S]*parseConfigInput[\s\S]*saveConfig/,
  'TK CLI 需要把 Firebase 配置保存到 gitignore 的 data/tk-cli，并支持环境变量'
);

assert.match(
  clientSource,
  /firestore\.googleapis\.com\/v1/,
  'TK CLI Firestore 客户端需要使用 Firestore REST API'
);

assert.match(
  clientSource,
  /requestJson[\s\S]*method:\s*'PATCH'/,
  'TK CLI Firestore 客户端需要支持 PATCH 写入'
);

assert.match(
  clientSource,
  /updateMask\.fieldPaths/,
  'TK CLI Firestore 客户端写入时需要使用 updateMask'
);

assert.match(
  clientSource,
  /method:\s*'DELETE'/,
  'TK CLI Firestore 客户端需要使用 Firestore REST API'
);

assert.match(
  accountsSource,
  /order_accounts[\s\S]*账号「\$\{targetAccount\}」不在当前数据库账号列表里[\s\S]*不要自动创建账号|order_accounts[\s\S]*不在当前数据库账号列表里/,
  'TK CLI 需要从 order_accounts 校验目标账号是否存在，不能自动创建账号'
);

assert.match(
  syncSource,
  /preflightCollection[\s\S]*probeWrite[\s\S]*syncCollectionRun[\s\S]*collection_records\.csv[\s\S]*selection_rejects\.csv[\s\S]*collection_records\/\$\{doc\.productKey\}[\s\S]*collection_excluded_products\/\$\{doc\.productKey\}[\s\S]*markDxmEdited[\s\S]*店小秘编辑状态[\s\S]*editedTitle/,
  'TK CLI 需要提供采集前检查、本地采集结果同步和店小秘编辑状态回写到 Firestore'
);

assert.match(
  collectionDocsSource,
  /removeCollectionEditFields[\s\S]*店小秘编辑状态[\s\S]*编辑时间[\s\S]*编辑标题[\s\S]*编辑判断[\s\S]*buildRecordDoc[\s\S]*removeCollectionEditFields/,
  'TK CLI 采集同步写 collection_records 时必须剥离编辑字段'
);

assert.doesNotMatch(
  collectionDocsSource,
  /hasDxmEditedInput|isDxmEdited|dxmEdited|getRowValue\(normalizedRow, \['编辑标题'[\s\S]*buildRecordDoc|候选品|评分|店小秘已编辑|是否已采集到店小秘|风险标记|编辑失败原因|function isEditJudgementText|cleanEditJudgementText|店小秘采集时间|collected_at|dxm_collected_at/,
  'TK CLI 采集同步不能兼容旧采集字段，也不能从采集行推导店小秘编辑状态、编辑标题或编辑时间'
);

assert.match(
  docsSource,
  /firestore-sync\.mjs preflight --account NOMA[\s\S]*firestore-sync\.mjs sync data\/collection\/fastmoss\/runs\/<run-id> --account NOMA[\s\S]*不依赖项目内 `npm run tk`/,
  '数据采集文档需要说明 skill 自带 Firestore 同步脚本，不把 TK CLI 作为用户采集路径'
);

assert.match(
  skillSource,
  /scripts\/firestore-sync\.mjs preflight --account[\s\S]*scripts\/firestore-sync\.mjs sync[\s\S]*不依赖项目内 `npm run tk`/,
  'tk-product-selection skill 需要把数据库前置校验和同步交给 skill 自带 Firestore 同步脚本'
);

const help = execFileSync('node', ['packages/cli/bin/tk.mjs', 'help'], {
  cwd: root,
  encoding: 'utf8'
});
assert.match(help, /TK CLI[\s\S]*collection preflight[\s\S]*collection sync[\s\S]*collection mark-dxm-edited/, 'TK CLI help 需要可执行');

const status = JSON.parse(execFileSync('node', ['packages/cli/bin/tk.mjs', 'db', 'status', '--json'], {
  cwd: root,
  encoding: 'utf8'
}));
assert.equal(typeof status.ok, 'boolean', 'db status 应返回布尔 ok 字段');
assert.equal(typeof status.connected, 'boolean', 'db status 应返回布尔 connected 字段');
assert.equal(status.connected, status.ok, 'db status 的 connected 和 ok 需要保持一致');
assert.ok(status.configPath.endsWith('data/tk-cli/firestore-config.json'), 'db status 需要返回默认配置路径');

console.log('tk cli contract ok');
