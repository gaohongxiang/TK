import {
  getCurrentSearchYear,
  matchesParsedSearchQuery,
  parseSearchQuery
} from '../search-query.ts';

type CsvRow = Record<string, string>;
type CollectionIndexedRow = {
  row: CsvRow;
  sourceIndex: number;
};
type CollectionSortOrder = 'asc' | 'desc';
type DeriveDisplayedCollectionRowsOptions = {
  rows?: CollectionIndexedRow[];
  activeAccount?: string;
  searchQuery?: string;
  sortOrder?: CollectionSortOrder;
  allAccountsKey?: string;
  currentYear?: number;
};

const COLLECTION_DATE_ALIASES = {
  'cj': '采集时间',
  '采集': '采集时间',
  '采集时间': '采集时间',
  'bj': '编辑时间',
  '编辑': '编辑时间',
  '编辑时间': '编辑时间'
};

function normalizeAccountName(value: unknown): string {
  return String(value || '').trim();
}

function getCollectionSearchText(row: CsvRow): unknown[] {
  return [
    row['账号'],
    row['商品名称'],
    row['店铺名'],
    row['采集状态'],
    row['选品判断'],
    row['店小秘编辑状态'],
    row['编辑标题'],
    row['编辑判断'],
    row['商品价格'],
    row['商品近7天销量'],
    row['商品链接'],
    row['核心 TK 链接']
  ];
}

function getCollectionSearchDate(row: CsvRow, field: string): unknown {
  return row[field] || '';
}

function deriveDisplayedCollectionRows({
  rows = [],
  activeAccount = '__all__',
  searchQuery = '',
  sortOrder = 'asc',
  allAccountsKey = '__all__',
  currentYear = getCurrentSearchYear()
}: DeriveDisplayedCollectionRowsOptions = {}): CollectionIndexedRow[] {
  const list = Array.isArray(rows) ? rows : [];
  const accountFiltered = activeAccount && activeAccount !== allAccountsKey
    ? list.filter(item => normalizeAccountName(item.row?.['账号']) === activeAccount)
    : list;
  const query = parseSearchQuery(searchQuery, {
    currentYear,
    defaultDateField: '采集时间',
    dateAliases: COLLECTION_DATE_ALIASES
  });
  const filtered = query.textTokens.length || query.dateFilters.length
    ? accountFiltered.filter(item => matchesParsedSearchQuery({
      query,
      record: item.row,
      getText: getCollectionSearchText,
      getDate: getCollectionSearchDate
    }))
    : accountFiltered;
  return [...filtered].sort((left, right) => (
    sortOrder === 'asc'
      ? left.sourceIndex - right.sourceIndex
      : right.sourceIndex - left.sourceIndex
  ));
}

const CollectionTableView = {
  COLLECTION_DATE_ALIASES,
  deriveDisplayedCollectionRows,
  getCollectionSearchDate,
  getCollectionSearchText
};

export {
  COLLECTION_DATE_ALIASES,
  CollectionTableView,
  deriveDisplayedCollectionRows,
  getCollectionSearchDate,
  getCollectionSearchText
};
export type {
  CollectionIndexedRow,
  CollectionSortOrder,
  CsvRow,
  DeriveDisplayedCollectionRowsOptions
};
