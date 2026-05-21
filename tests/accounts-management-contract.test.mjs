import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const helperPath = path.join(root, 'src', 'accounts', 'firestore-account-actions.ts');
const helperSource = fs.readFileSync(helperPath, 'utf8');
const accountTabsSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'account-tabs-bar.tsx'), 'utf8');
const accountDialogsSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'account-manage-dialogs.tsx'), 'utf8');
const productsPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const collectionPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'collection', 'CollectionPage.tsx'), 'utf8');
const financePageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'finance', 'FinancePage.tsx'), 'utf8');
const analyticsPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'analytics', 'AnalyticsApp.tsx'), 'utf8');
const productsProviderSource = fs.readFileSync(path.join(root, 'src', 'products', 'provider-firestore.ts'), 'utf8');
const ordersProviderSource = fs.readFileSync(path.join(root, 'src', 'orders', 'provider-firestore.ts'), 'utf8');
const collectionProviderSource = fs.readFileSync(path.join(root, 'src', 'collection', 'provider-firestore.ts'), 'utf8');
const financeProviderSource = fs.readFileSync(path.join(root, 'src', 'finance', 'provider-firestore.ts'), 'utf8');
const analyticsProviderSource = fs.readFileSync(path.join(root, 'src', 'analytics', 'provider-firestore.ts'), 'utf8');

assert.match(
  accountTabsSource,
  /AccountTabActions[\s\S]*group-hover:pointer-events-auto[\s\S]*✎[\s\S]*×/,
  '账号标签需要提供 hover 才滑出的抽屉式编辑/删除入口'
);

assert.match(
  accountTabsSource,
  /全部<AccountCount[\s\S]*items\.length \? items\.map[\s\S]*<AccountTabActions/,
  '账号管理菜单只能挂在具体账号标签上，不能挂在“全部”标签上'
);

assert.doesNotMatch(
  accountTabsSource,
  /<TabsTrigger[\s\S]*<AccountTabActions[\s\S]*<\/TabsTrigger>/,
  '账号菜单按钮不能嵌套在 tab button 内部'
);

assert.match(
  accountDialogsSource,
  /编辑账号名[\s\S]*新账号名称[\s\S]*删除账号名[\s\S]*不会删除商品、订单或采集记录[\s\S]*只在“全部”里显示/,
  '账号编辑和删除确认弹窗需要说明数据不会删除，只会落到全部'
);

for (const [name, source, prefix] of [
  ['商品管理', productsPageSource, 'pl'],
  ['订单管理', ordersPageSource, 'ot'],
  ['商品采编', collectionPageSource, 'collection'],
  ['数据分析', analyticsPageSource, 'analytics']
]) {
  assert.match(
    source,
    /onEditAccount=\{openEditAccount\}[\s\S]*onDeleteAccount=\{openDeleteAccount\}/,
    `${name} 需要给 AccountTabsBar 接入编辑和删除入口`
  );
  assert.match(
    source,
    new RegExp(`modalId="${prefix}-edit-acc-modal"[\\s\\S]*onConfirm=\\{renameAccount\\}[\\s\\S]*modalId="${prefix}-delete-acc-modal"[\\s\\S]*onConfirm=\\{deleteAccount\\}`),
    `${name} 需要渲染账号编辑和删除确认弹窗`
  );
  assert.match(
    source,
    /setActiveAccount\(current => current === ['"]__all__['"]|setActiveAccount\(current => current === ALL_ACCOUNTS_KEY/,
    `${name} 删除或收到跨模块账号变更后，需要把已删除的当前账号回落到“全部”`
  );
}

assert.match(
  ordersPageSource,
  /if \(activeAccount === '__all__' \|\| allAccounts\.includes\(activeAccount\)\) return;[\s\S]*setActiveAccount\('__all__'\)/,
  '订单管理必须兜底处理已删除账号，不能停留在不存在的账号筛选上'
);

assert.match(
  helperSource,
  /renameAccountAcrossModules[\s\S]*renameProductAccounts[\s\S]*renameOrderAccounts[\s\S]*renameCollectionAccounts[\s\S]*renameAnalyticsAccounts[\s\S]*renameFinanceAccounts/,
  '共享账号 helper 需要在重命名时迁移商品、订单、采集记录、数据分析快照和收支记录账号引用'
);

assert.match(
  helperSource,
  /deleteAccountLabel[\s\S]*collection\('order_accounts'\)[\s\S]*deletedAt:[\s\S]*setAccountOrderMutations/,
  '删除账号名应只软删除共享账号标签并重排账号表'
);

assert.doesNotMatch(
  helperSource,
  /\.delete\(/,
  '删除账号名不能调用 Firestore delete() 删除任何业务文档'
);

const deleteFunctionBody = helperSource.match(/async function deleteAccountLabel[\s\S]*?\n}\n\nexport \{/)?.[0] || '';
assert.match(deleteFunctionBody, /collection\('order_accounts'\)/, '删除账号名应只写共享账号表');
assert.doesNotMatch(deleteFunctionBody, /collection\('products'\)|collection\('orders'\)|collection\('collection_records'\)|collection\('collection_excluded_products'\)/, '删除账号名不能写商品、订单或采集业务集合');

for (const [name, source] of [
  ['商品 provider', productsProviderSource],
  ['订单 provider', ordersProviderSource],
  ['商品采编 provider', collectionProviderSource],
  ['收支 provider', financeProviderSource],
  ['数据分析 provider', analyticsProviderSource]
]) {
  assert.match(source, /renameAccountAcrossModules[\s\S]*deleteAccountLabel/, `${name} 需要复用共享账号重命名和删除逻辑`);
  assert.match(source, /renameAccount[\s\S]*deleteAccount/, `${name} 需要暴露 renameAccount 和 deleteAccount`);
}

for (const [name, source] of [
  ['商品管理', productsPageSource],
  ['订单管理', ordersPageSource],
  ['商品采编', collectionPageSource],
  ['收支管理', financePageSource],
  ['数据分析', analyticsPageSource]
]) {
  assert.match(
    source,
    /detail\.action === 'reorder'[\s\S]*detail\.action === 'upsert'[\s\S]*detail\.action === 'rename'[\s\S]*detail\.action === 'delete'[\s\S]*return/,
    `${name} 收到账号排序/增删改事件时应先使用事件里的账号列表，不能马上用旧远端顺序覆盖`
  );
}

const module = await import(pathToFileURL(helperPath).href);
assert.deepStrictEqual(
  module.buildRenamedAccountOrder(['NOMA', 'LUMI'], 'NOMA', 'MOMA'),
  ['MOMA', 'LUMI'],
  '重命名账号需要保持原排序位置'
);
assert.deepStrictEqual(
  module.buildDeletedAccountOrder(['NOMA', 'LUMI'], 'NOMA'),
  ['LUMI'],
  '删除账号名只移除账号标签'
);
assert.throws(
  () => module.buildRenamedAccountOrder(['NOMA', 'LUMI'], 'NOMA', 'LUMI'),
  /已存在/,
  '重命名账号不能覆盖已有账号'
);

console.log('accounts management contract ok');
