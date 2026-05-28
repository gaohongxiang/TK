import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const appConfigSource = fs.readFileSync(path.join(root, 'src', 'app-config.ts'), 'utf8');
const reactAppSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'App.tsx'), 'utf8');
const financePageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'finance', 'FinancePage.tsx'), 'utf8');
const financeProviderSource = fs.readFileSync(path.join(root, 'src', 'finance', 'provider-firestore.ts'), 'utf8');
const financeSummarySource = fs.readFileSync(path.join(root, 'src', 'finance', 'summary.ts'), 'utf8');
const rulesSource = fs.readFileSync(path.join(root, 'src', 'orders', 'firestore-rules.ts'), 'utf8');
const rulesCompatibilitySource = fs.readFileSync(path.join(root, 'src', 'firestore-rules-compatibility.ts'), 'utf8');
const accountActionsSource = fs.readFileSync(path.join(root, 'src', 'accounts', 'firestore-account-actions.ts'), 'utf8');

assert.match(
  appConfigSource,
  /finance:\s*'user-owned-firestore'[\s\S]*key:\s*'finance',\s*label:\s*'收支管理'/,
  '收支管理需要注册为用户自有 Firestore 数据模块'
);

assert.match(
  reactAppSource,
  /import \{ FinancePage \} from '\.\.\/features\/finance\/FinancePage'[\s\S]*id="view-finance"[\s\S]*<FinancePage active=\{active === 'finance'\} \/>/,
  '主站需要渲染收支管理视图'
);

assert.match(
  financeSummarySource,
  /COST_CATEGORIES[\s\S]*'开店成本'[\s\S]*'IP成本'[\s\S]*'投流成本'[\s\S]*'软件订阅'[\s\S]*'样品费'[\s\S]*'手续费'[\s\S]*DEPOSIT_HOLD_CATEGORY[\s\S]*DEPOSIT_PAID_CATEGORY[\s\S]*'其他'/,
  '收支管理需要内置经营成本类别'
);

assert.match(
  financeSummarySource,
  /ACTUAL_INCOME_CATEGORY = 'TK提现'[\s\S]*ACTUAL_INCOME_CATEGORIES[\s\S]*ACTUAL_INCOME_CATEGORY[\s\S]*'其他回款'[\s\S]*'押金退回'[\s\S]*DEPOSIT_HOLD_CATEGORY = '押金'[\s\S]*DEPOSIT_PAID_CATEGORY = '押金扣除'[\s\S]*DEPOSIT_RETURN_CATEGORY = '押金退回'[\s\S]*FINANCE_RECORD_KINDS: FinanceRecordKind\[\] = \['actual_income', 'cost'\]/,
  '收支记录类型只能是成本和回款，押金/押金扣除/退回应作为类别'
);

assert.match(
  financeSummarySource,
  /PUBLIC_ACCOUNT_KEY = '__public__'[\s\S]*PUBLIC_ACCOUNT_LABEL = '公共账'[\s\S]*if \(account === PUBLIC_ACCOUNT_KEY\) return !normalizeText\(record\?\.accountName\)[\s\S]*if \(account === PUBLIC_ACCOUNT_KEY\) return false[\s\S]*filterFinanceOrders\(orders, \{ activeAccount, month, query \}\)/,
  '公共账需要作为独立筛选项，只筛选无账号收支，不包含订单'
);

assert.match(
  financeSummarySource,
  /derivePurchaseSummary[\s\S]*estimatedIncome[\s\S]*repaymentIncome[\s\S]*cashOrderCost[\s\S]*cashNetProfit/,
  '预估收入需要复用订单利润，现金口径需要用回款扣订单成本和运营成本'
);

assert.match(
  financeProviderSource,
  /collection\('finance_records'\)[\s\S]*collection\('orders'\)[\s\S]*collection\('order_accounts'\)[\s\S]*upsertRecord[\s\S]*deleteRecord/,
  '收支 Provider 需要读收支记录、订单和账号，并支持保存和删除记录'
);

assert.match(
  rulesSource,
  /match \/finance_records\/\{recordId\}[\s\S]*allow read, write: if canUse\('finance'\)/,
  '最新 Firestore 规则需要用 finance 权限保护 finance_records 集合'
);

assert.match(
  rulesCompatibilitySource,
  /finance_records\.read[\s\S]*finance_records\.write[\s\S]*key:\s*'finance'[\s\S]*收支管理保存不可用/,
  '规则兼容检查需要覆盖收支管理'
);

assert.match(
  accountActionsSource,
  /renameFinanceAccounts[\s\S]*collection\('finance_records'\)[\s\S]*renameAccountAcrossModules[\s\S]*renameFinanceAccounts/,
  '账号重命名需要同步迁移收支记录账号归属'
);

assert.match(
  financePageSource,
  /预估口径[\s\S]*来自订单管理预估利润[\s\S]*预估净利润[\s\S]*renderDepositSwitch\(\)[\s\S]*预估收入[\s\S]*运营成本[\s\S]*押金占用[\s\S]*现金口径[\s\S]*现金净额[\s\S]*renderDepositSwitch\(\)[\s\S]*回款[\s\S]*订单成本[\s\S]*运营成本[\s\S]*押金占用/,
  '收支页面左侧保持预估口径，右侧需要改成现金口径并支持净额是否扣押金'
);

assert.match(
  financePageSource,
  /financeSummaryLedgerClass = 'finance-summary-ledger[\s\S]*grid-cols-3/,
  '预估收入、运营成本、押金占用需要横排'
);

assert.match(
  financePageSource,
  /financeSummaryCashLedgerClass = 'finance-summary-ledger finance-summary-cash-ledger[\s\S]*grid-cols-4[\s\S]*financeSummaryCashLedgerValueClass = '[^']*text-\[16px\][\s\S]*financeSummaryCashLedgerNoteClass = '[^']*text-\[10px\]/,
  '现金口径需要用更紧凑的四列展示回款、订单成本、运营成本和押金占用'
);

assert.match(
  financePageSource,
  /const \[includeDeposit, setIncludeDeposit\] = useState\(false\)/,
  '净额押金口径默认应为不算押金'
);

assert.match(
  financePageSource,
  /financeSummaryDepositSwitchClass = '[^']*w-\[70px\][^']*rounded-full[\s\S]*financeSummaryDepositDividerClass[\s\S]*financeSummaryDepositKnobClass[\s\S]*role="switch"[\s\S]*aria-checked=\{includeDeposit\}[\s\S]*<span>押金<\/span>[\s\S]*financeSummaryDepositDividerClass[\s\S]*includeDeposit \? 'left-\[48px\]' : 'left-\[37px\]'/,
  '预估收入、运营成本、押金占用需要横排，净额后面需要只有一个外层胶囊的押金开关'
);

assert.doesNotMatch(
  financePageSource,
  /financeSummaryDepositTrackClass/,
  '押金开关不能再套第二个内部滑块框'
);

assert.match(
  financePageSource,
  /financeSummaryLedgerNoteClass = '[^']*whitespace-nowrap[\s\S]*depositNote = `支\$\{formatCompactFinanceMoney\(summary\.depositsPaid\.total\)\} \/ 退\$\{formatCompactFinanceMoney\(summary\.depositsReturned\.total\)\}`/,
  '押金占用明细需要短格式且不能换行'
);

assert.match(
  financePageSource,
  /押金占用[\s\S]*ledgerValueClass\(summary\.depositBalance, 'expense'\)/,
  '左侧押金占用金额需要按支出红色显示'
);

assert.match(
  financePageSource,
  /financeSummarySurfaceClass[\s\S]*financeSummaryGridClass[\s\S]*grid-cols-2[\s\S]*预估口径[\s\S]*预估净利润[\s\S]*现金口径[\s\S]*现金净额/,
  '收支汇总需要使用和订单管理一致的左右双栏账本布局'
);

assert.match(
  financePageSource,
  /id="finance-add-record"[\s\S]*新增收支/,
  '收支页面只需要一个新增收支按钮'
);

assert.doesNotMatch(
  financePageSource,
  /finance-add-cost|finance-add-deposit|finance-add-income|value="deposit_paid"|value="deposit_return"|value="deposit_loss"/,
  '页面不能再出现单独的新增成本/押金/回款入口或押金记录类型'
);

assert.match(
  financePageSource,
  /cashOrderCostNote = `采购价 \$\{formatCompactFinanceMoney\(summary\.orderPurchaseCost\.total\)\} \/ 贴单费 \$\{formatCompactFinanceMoney\(summary\.orderLabelFee\.total\)\}`[\s\S]*按实际到账计算，押金可切换计入净额[\s\S]*现金净额[\s\S]*summary\.repaymentIncome\.total[\s\S]*TK 结算已扣运费[\s\S]*订单成本[\s\S]*summary\.cashOrderCost\.total[\s\S]*押金占用[\s\S]*summary\.depositBalance/,
  '右侧现金口径需要说明 TK 运费已在回款中扣除，并把采购价+贴单费合并为订单成本'
);

assert.match(
  financePageSource,
  /PUBLIC_ACCOUNT_KEY[\s\S]*PUBLIC_ACCOUNT_LABEL[\s\S]*publicRecordCount[\s\S]*key: PUBLIC_ACCOUNT_KEY[\s\S]*label: PUBLIC_ACCOUNT_LABEL/,
  '收支页面需要保留全部，同时增加公共账筛选项'
);

assert.match(
  financePageSource,
  /const \[month\] = useState\(''\)/,
  '收支页面默认应看全部月份'
);

assert.match(
  financePageSource,
  /<TableSearch[\s\S]*hint="搜索日期 \/ 类别 \/ 备注 \/ 金额"/,
  '收支页面应使用搜索框搜索日期'
);

assert.match(
  financePageSource,
  /getFinanceAccountLabel\(record\.accountName\)/,
  '无账号记录在表格里应显示为公共账'
);

assert.match(
  financePageSource,
  /<option value="">\{PUBLIC_ACCOUNT_LABEL\}<\/option>/,
  '无账号记录在表格和弹窗里都应显示为公共账'
);

assert.doesNotMatch(
  financePageSource,
  /finance-month|onMonthChange|setMonth|全部 \/ 不指定|全局成本|全局收入/,
  '收支页面不应再显示单独月份筛选，也不能再把公共账叫成全局或全部/不指定'
);

assert.doesNotMatch(
  financePageSource,
  /summaryCardClass|SummaryTile/,
  '收支汇总不能退回 6 个等权卡片的平铺布局'
);

assert.match(
  financePageSource,
  /financeContentClass = 'finance-content mt-4'[\s\S]*<div className=\{financeContentClass\}>[\s\S]*<FinanceSummaryView/,
  '收支汇总卡片和顶部状态条之间需要保留间距'
);

assert.doesNotMatch(
  financePageSource,
  /function exportRecordsCsv|id="finance-export"|FileDown/,
  '收支管理不应再保留模块内导出入口，导出统一放进顶部账号菜单'
);

assert.match(
  financePageSource,
  /financeTableFrameClass = 'finance-table-frame block w-full[\s\S]*financeTableClass = 'finance-react-table[\s\S]*w-full[\s\S]*table-fixed[\s\S]*<TableFrame className=\{financeTableFrameClass\}>[\s\S]*<Table className=\{financeTableClass\}>/,
  '收支记录表格需要铺满列表区域'
);

assert.match(
  financePageSource,
  /<TableHead className="w-\[64px\]">#<\/TableHead>[\s\S]*<TableHead className="w-\[150px\]">账号<\/TableHead>[\s\S]*<TableHead className="w-\[150px\]">日期<\/TableHead>[\s\S]*<TableHead className="w-\[140px\]">金额\(¥\)<\/TableHead>[\s\S]*getFinanceDisplaySeq\(absoluteIndex, filtered\.length, sortOrder\)[\s\S]*<TableCell className="text-\[var\(--muted\)\]">\{seqNum\}<\/TableCell>[\s\S]*record\.accountName[\s\S]*<TableCell>\{record\.occurredAt[\s\S]*getAmountToneClass\(accountingKind\)/,
  '收支记录表格账号列需要放在 # 后面，金额列需要放在日期后面'
);

assert.match(
  financePageSource,
  /function getFinanceDisplaySeq\(absoluteIndex: number, total: number, sortOrder: string\): number \{[\s\S]*sortOrder === 'asc' \? absoluteIndex \+ 1 : total - absoluteIndex/,
  '倒序显示时 # 必须反序，保持输入序号不随显示顺序变化'
);

assert.match(
  financePageSource,
  /function showNativeDatePicker\(input: HTMLInputElement\)[\s\S]*showPicker[\s\S]*function FinanceDateInput[\s\S]*type="date"[\s\S]*showNativeDatePicker\(event\.currentTarget\)[\s\S]*<CalendarDays className=\{financeDateInputIconClass\}[\s\S]*<FinanceDateInput id="finance-record-date"/,
  '收支记录日期输入需要整框可点，日历图标固定在右侧'
);

const module = await import(pathToFileURL(path.join(root, 'src', 'finance', 'summary.ts')).href);
const summary = module.deriveFinanceSummary({
  exchangeRate: 20,
  platformFeeRate: 0,
  month: '2026-05',
  records: [
    { id: 'income', kind: 'actual_income', accountName: 'A', category: 'TK提现', amount: 40, occurredAt: '2026-05-20', note: '', createdAt: '', updatedAt: '' },
    { id: 'cost', kind: 'cost', accountName: 'A', category: '投流成本', amount: 12, occurredAt: '2026-05-21', note: '', createdAt: '', updatedAt: '' },
    { id: 'deposit-hold', kind: 'cost', accountName: 'A', category: '押金', amount: 30, occurredAt: '2026-05-21', note: '', createdAt: '', updatedAt: '' },
    { id: 'deposit-deducted', kind: 'cost', accountName: 'A', category: '押金扣除', amount: 5, occurredAt: '2026-05-21', note: '', createdAt: '', updatedAt: '' },
    { id: 'deposit-return', kind: 'actual_income', accountName: 'A', category: '押金退回', amount: 10, occurredAt: '2026-05-22', note: '', createdAt: '', updatedAt: '' }
  ],
  orders: [
    { id: 'order1', '账号': 'A', '下单时间': '2026-05-19', '售价': 1000, '采购价格': 20, '预估运费': 5, '达人佣金率': '' }
  ],
  activeAccount: 'A',
  labelFee: 1.2
});

assert.strictEqual(summary.estimatedIncome.total, 25, '订单利润 1000 / 20 - 20 - 5 应作为预估收入');
assert.strictEqual(summary.actualIncome.total, 50, '回款总额应包含 TK 提现和押金退回');
assert.strictEqual(summary.repaymentIncome.total, 40, '现金口径回款应排除押金退回，避免押金口径重复计算');
assert.strictEqual(summary.costs.total, 17, '运营成本应包含普通成本和押金扣除，不包含押金占用');
assert.strictEqual(summary.orderPurchaseCost.total, 20, '现金口径订单成本需要包含订单采购价');
assert.strictEqual(summary.orderLabelFee.total, 1.2, '现金口径订单成本需要按订单数乘以全局贴单费');
assert.strictEqual(summary.cashOrderCost.total, 21.2, '现金口径订单成本 = 采购价 + 贴单费');
assert.strictEqual(summary.depositsPaid.total, 30, '押金类别需要单独汇总为押金占用来源');
assert.strictEqual(summary.depositsReturned.total, 10, '押金退回需要单独汇总');
assert.strictEqual(summary.depositLosses.total, 5, '押金扣除需要汇总为押金损失/扣除');
assert.strictEqual(summary.estimatedNetProfit, 8, '预估净利润默认 = 预估收入 - 运营成本');
assert.strictEqual(summary.cashNetProfit, 1.8, '现金净额默认 = 回款 - 订单采购价 - 贴单费 - 运营成本');
assert.strictEqual(summary.depositBalance, 15, '押金占用 = 押金 - 押金退回 - 押金扣除');
assert.strictEqual(summary.pendingIncome, -15, '待确认收入 = 预估收入 - 回款');

const publicSummary = module.deriveFinanceSummary({
  exchangeRate: 20,
  records: [
    { id: 'public-cost', kind: 'cost', accountName: '', category: '投流成本', amount: 100, occurredAt: '2026-05-20', note: '', createdAt: '', updatedAt: '' },
    { id: 'account-cost', kind: 'cost', accountName: 'A', category: '投流成本', amount: 12, occurredAt: '2026-05-21', note: '', createdAt: '', updatedAt: '' }
  ],
  orders: [
    { id: 'order-a', '账号': 'A', '下单时间': '2026-05-19', '售价': 1000, '采购价格': 20, '预估运费': 5, '达人佣金率': '' }
  ],
  activeAccount: module.PUBLIC_ACCOUNT_KEY
});

assert.strictEqual(publicSummary.orderCount, 0, '公共账筛选不应包含任何账号订单');
assert.strictEqual(publicSummary.costs.total, 100, '公共账筛选只统计无账号收支记录');

const searchedSummary = module.deriveFinanceSummary({
  exchangeRate: 20,
  query: '2026-05',
  records: [
    { id: 'may-public-cost', kind: 'cost', accountName: '', category: '投流成本', amount: 100, occurredAt: '2026-05-20', note: '', createdAt: '', updatedAt: '' },
    { id: 'june-public-cost', kind: 'cost', accountName: '', category: '投流成本', amount: 300, occurredAt: '2026-06-01', note: '', createdAt: '', updatedAt: '' }
  ],
  orders: [
    { id: 'order-may', '账号': 'A', '下单时间': '2026-05-19', '售价': 1000, '采购价格': 20, '预估运费': 5, '达人佣金率': '' },
    { id: 'order-june', '账号': 'A', '下单时间': '2026-06-01', '售价': 2000, '采购价格': 10, '预估运费': 5, '达人佣金率': '' }
  ]
});

assert.strictEqual(searchedSummary.orderCount, 1, '搜索 2026-05 时订单预估收入也需要按日期搜索同步过滤');
assert.strictEqual(searchedSummary.costs.total, 100, '搜索 2026-05 时收支记录需要按日期搜索过滤');

const ordered = module.filterFinanceRecords([
  { id: 'old', kind: 'cost', accountName: 'A', category: '开店成本', amount: 1, occurredAt: '2026-05-22', note: '', createdAt: '2026-05-19T00:00:00.000Z', updatedAt: '2026-05-22T00:00:00.000Z' },
  { id: 'new-edited', kind: 'cost', accountName: 'A', category: '开店成本', amount: 1, occurredAt: '2026-05-20', note: '', createdAt: '2026-05-20T00:00:00.000Z', updatedAt: '2026-05-21T00:00:00.000Z' }
], { activeAccount: 'A', month: '2026-05' });

assert.deepStrictEqual(
  ordered.map(record => record.id),
  ['old', 'new-edited'],
  '收支记录筛选后应按输入创建顺序排序，编辑时间和发生日期不能改变 #'
);

console.log('finance module contract ok');
