import { getStringFlag, hasFlag, parseArgs } from './args.mjs';
import { loadAccounts, requireAccount } from './accounts.mjs';
import { configPath, loadConfig, saveConfig } from './firestore-config.mjs';
import { markDxmEdited, preflightCollection, syncCollectionRun } from './collection-sync.mjs';
import { writeResult } from './output.mjs';

const HELP = `TK CLI

用法：
  npm run tk -- db setup --config '<firebaseConfig>'
  npm run tk -- db status
  npm run tk -- accounts list
  npm run tk -- accounts check <账号>
  npm run tk -- collection preflight --account <账号>
  npm run tk -- collection sync <run-dir> --account <账号>
  npm run tk -- collection mark-dxm-edited --account <账号> --product-url <商品链接> --product-name <商品名称> --edited-title <编辑标题>

选项：
  --json                 输出 JSON，方便 Codex/AI 读取
  --config <config>      本次命令直接使用 firebaseConfig
`;

async function main(argv) {
  const { positional, flags } = parseArgs(argv);
  const [scope, action, ...rest] = positional;
  const json = hasFlag(flags, 'json');
  const root = process.cwd();
  const configText = getStringFlag(flags, 'config');

  if (!scope || scope === 'help' || hasFlag(flags, 'help')) {
    process.stdout.write(HELP);
    return;
  }

  if (scope === 'db') {
    await handleDb(action, { flags, json, root, configText });
    return;
  }
  if (scope === 'accounts') {
    await handleAccounts(action, rest, { flags, json, root, configText });
    return;
  }
  if (scope === 'collection') {
    await handleCollection(action, rest, { flags, json, root, configText });
    return;
  }
  throw new Error(`未知命令：${scope}\n\n${HELP}`);
}

async function handleDb(action, options) {
  if (action === 'setup') {
    const rawConfig = options.configText || getStringFlag(options.flags, ['from']);
    if (!rawConfig) throw new Error('缺少 Firebase 配置：请使用 --config \'<firebaseConfig>\'。');
    const result = await saveConfig(rawConfig, { root: options.root });
    writeResult({
      ok: true,
      projectId: result.config.projectId,
      configPath: result.file,
      message: `已保存 Firebase 配置：${result.config.projectId}`
    }, options);
    return;
  }
  if (action === 'status') {
    const config = await loadConfig({ root: options.root, configText: options.configText });
    writeResult({
      ok: Boolean(config),
      connected: Boolean(config),
      projectId: config?.projectId || '',
      configPath: configPath(options.root),
      message: config ? `已配置 Firebase：${config.projectId}` : '还没有配置 Firebase。'
    }, options);
    return;
  }
  throw new Error(`未知 db 命令：${action || ''}`);
}

async function handleAccounts(action, rest, options) {
  if (action === 'list') {
    const state = await loadAccounts(options);
    writeResult({
      ok: true,
      projectId: state.config.projectId,
      accounts: state.accounts,
      firstAccount: state.accounts[0] || '',
      message: state.accounts.length ? `当前账号：${state.accounts.join('、')}` : '当前数据库还没有账号。'
    }, options);
    return;
  }
  if (action === 'check') {
    const account = rest[0] || getStringFlag(options.flags, 'account');
    const state = await requireAccount(account, options);
    writeResult({
      ok: true,
      projectId: state.config.projectId,
      targetAccount: state.targetAccount,
      targetAccountExists: true,
      firstAccount: state.firstAccount,
      accounts: state.accounts,
      message: `账号「${state.targetAccount}」存在。`
    }, options);
    return;
  }
  throw new Error(`未知 accounts 命令：${action || ''}`);
}

async function handleCollection(action, rest, options) {
  if (action === 'preflight') {
    const account = getStringFlag(options.flags, 'account') || rest[0];
    const result = await preflightCollection({ ...options, account });
    writeResult({
      ...result,
      message: `采集前检查通过。目标账号：${result.targetAccount}。`
    }, options);
    return;
  }
  if (action === 'sync') {
    const runDir = rest[0] || getStringFlag(options.flags, 'run-dir');
    const account = getStringFlag(options.flags, 'account');
    const result = await syncCollectionRun(runDir, { ...options, account });
    writeResult({
      ...result,
      message: `同步完成：采集记录 ${result.recordsSynced} 条，拒绝品 ${result.rejectsSynced} 条。`
    }, options);
    return;
  }
  if (action === 'mark-dxm-edited') {
    const account = getStringFlag(options.flags, 'account');
    const result = await markDxmEdited({
      ...options,
      account,
      productKey: getStringFlag(options.flags, ['product-key', 'productKey']),
      productId: getStringFlag(options.flags, ['product-id', 'productId']),
      productUrl: getStringFlag(options.flags, ['product-url', 'productUrl']),
      productName: getStringFlag(options.flags, ['product-name', 'productName', 'title']),
      editedTitle: getStringFlag(options.flags, ['edited-title', 'editedTitle']),
      editedAt: getStringFlag(options.flags, ['edited-at', 'editedAt'])
    });
    writeResult({
      ...result,
      message: `店小秘编辑状态已回写：${result.productKey}。`
    }, options);
    return;
  }
  throw new Error(`未知 collection 命令：${action || ''}`);
}

export {
  main
};
