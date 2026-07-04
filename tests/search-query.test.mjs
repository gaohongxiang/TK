import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const searchPath = path.join(__dirname, '..', 'src', 'search-query.ts');

(async () => {
  const search = await import(pathToFileURL(searchPath).href);

  const parsedText = search.parseSearchQuery('NOMA 雨衣 5834 顺丰', {
    currentYear: 2026,
    defaultDateField: '下单时间'
  });
  assert.deepEqual(parsedText.textTokens, ['noma', '雨衣', '5834', '顺丰'], '裸文本应按空格解析为文本 token');
  assert.deepEqual(parsedText.dateFilters, [], '裸文本不应被误解析为日期');

  const bareDate = search.parseSearchQuery('05-18', {
    currentYear: 2026,
    defaultDateField: '下单时间'
  });
  assert.deepEqual(
    bareDate.dateFilters,
    [{ field: '下单时间', operator: 'eq', value: '2026-05-18' }],
    '不写年份的裸日期应默认补当前年 2026'
  );

  const range = search.parseSearchQuery('下单:05-01～05-18', {
    currentYear: 2026,
    dateAliases: { '下单': '下单时间' }
  });
  assert.deepEqual(
    range.dateFilters,
    [{ field: '下单时间', operator: 'range', value: '2026-05-01', endValue: '2026-05-18' }],
    '范围日期应解析为 range 过滤'
  );

  const comparison = search.parseSearchQuery('采购:>=05-18 到仓:<=05-25', {
    currentYear: 2026,
    dateAliases: { '采购': '采购日期', '到仓': '最晚到仓时间' }
  });
  assert.deepEqual(
    comparison.dateFilters,
    [
      { field: '采购日期', operator: 'gte', value: '2026-05-18' },
      { field: '最晚到仓时间', operator: 'lte', value: '2026-05-25' }
    ],
    '比较日期应解析为 >= 和 <= 过滤'
  );

  const aliasComparison = search.parseSearchQuery('CG:>=05-18 dc:<=05-25', {
    currentYear: 2026,
    dateAliases: { 'cg': '采购日期', 'dc': '最晚到仓时间' }
  });
  assert.deepEqual(
    aliasComparison.dateFilters,
    [
      { field: '采购日期', operator: 'gte', value: '2026-05-18' },
      { field: '最晚到仓时间', operator: 'lte', value: '2026-05-25' }
    ],
    '英文键盘日期别名应大小写不敏感，并解析为对应日期字段'
  );

  const fullWidthSyntax = search.parseSearchQuery('CG：＞＝05/18 dc：＜＝05.25', {
    currentYear: 2026,
    dateAliases: { 'cg': '采购日期', 'dc': '最晚到仓时间' }
  });
  assert.deepEqual(
    fullWidthSyntax.dateFilters,
    [
      { field: '采购日期', operator: 'gte', value: '2026-05-18' },
      { field: '最晚到仓时间', operator: 'lte', value: '2026-05-25' }
    ],
    '搜索日期语法应兼容中文冒号、全角比较符和 / . 日期分隔'
  );

  const combo = search.parseSearchQuery('NOMA 雨衣 下单:05-01～05-18 采购:>=05-18', {
    currentYear: 2026,
    dateAliases: { '下单': '下单时间', '采购': '采购日期' }
  });
  assert.deepEqual(combo.textTokens, ['noma', '雨衣'], '组合搜索应保留文本 token');
  assert.equal(combo.dateFilters.length, 2, '组合搜索应同时保留多个日期过滤');

  const fieldScoped = search.parseSearchQuery('NOMA 备注:催 bz:急', {
    currentYear: 2026,
    defaultDateField: '下单时间',
    dateAliases: { '下单': '下单时间' },
    fieldAliases: { '备注': '备注', 'bz': '备注' }
  });
  assert.deepEqual(fieldScoped.textTokens, ['noma'], '字段限定搜索不应混入普通文本 token');
  assert.deepEqual(
    fieldScoped.fieldFilters,
    [
      { field: '备注', value: '催' },
      { field: '备注', value: '急' }
    ],
    '字段限定搜索应解析为字段过滤条件'
  );

  assert.equal(
    search.matchesParsedSearchQuery({
      query: fieldScoped,
      record: { account: 'NOMA', note: '催 急', orderedAt: '2026-05-12' },
      getText: record => [record.account],
      getFieldText: (record, field) => field === '备注' ? [record.note] : [],
      getDate: record => record.orderedAt
    }),
    true,
    '共享匹配器应同时支持普通文本和字段限定过滤'
  );

  const productText = search.parseSearchQuery('05-18', { enableBareDate: false });
  assert.deepEqual(productText.textTokens, ['05-18'], '禁用裸日期时，05-18 应作为普通文本搜索');
  assert.deepEqual(productText.dateFilters, [], '禁用裸日期时不应产生日期过滤');

  assert.equal(
    search.matchesParsedSearchQuery({
      query: combo,
      record: { name: 'NOMA 雨衣', orderedAt: '2026-05-12', purchaseAt: '2026-05-18' },
      getText: record => [record.name],
      getDate: (record, field) => field === '下单时间' ? record.orderedAt : record.purchaseAt
    }),
    true,
    '共享匹配器应同时匹配文本、范围和比较日期'
  );

  console.log('search query contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
