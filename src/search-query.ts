type SearchDateOperator = 'eq' | 'gte' | 'lte' | 'range';

type SearchDateFilter = {
  field: string;
  operator: SearchDateOperator;
  value: string;
  endValue?: string;
};

type SearchDateAliasMap = Record<string, string>;

type SearchFieldFilter = {
  field: string;
  value: string;
};

type SearchFieldAliasMap = Record<string, string>;

type ParseSearchQueryOptions = {
  currentYear?: number;
  defaultDateField?: string;
  dateAliases?: SearchDateAliasMap;
  fieldAliases?: SearchFieldAliasMap;
  enableBareDate?: boolean;
};

type ParsedSearchQuery = {
  raw: string;
  textTokens: string[];
  dateFilters: SearchDateFilter[];
  fieldFilters: SearchFieldFilter[];
};

type SearchableRecordOptions<T> = {
  query: ParsedSearchQuery;
  record: T;
  getText: (record: T) => unknown[];
  getDate: (record: T, field: string) => unknown;
  getFieldText?: (record: T, field: string) => unknown[];
};

const DEFAULT_CURRENT_YEAR = 2026;

function normalizeSearchValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function getCurrentSearchYear(value: unknown = new Date()): number {
  if (value instanceof Date && Number.isFinite(value.getFullYear())) return value.getFullYear();
  const parsed = new Date(String(value || ''));
  return Number.isNaN(parsed.getTime()) ? DEFAULT_CURRENT_YEAR : parsed.getFullYear();
}

function normalizeDateSeparator(value: string): string {
  return String(value || '').trim().replace(/[./／．]/g, '-').replace(/[－—–]/g, '-');
}

function normalizeSearchExpression(value: string): string {
  return normalizeDateSeparator(value)
    .replace(/[＞﹥]/g, '>')
    .replace(/[＜﹤]/g, '<')
    .replace(/[＝]/g, '=');
}

function padDatePart(value: string): string {
  return value.padStart(2, '0');
}

function parseSearchDate(value: unknown, currentYear = DEFAULT_CURRENT_YEAR): string | null {
  const text = normalizeDateSeparator(String(value || ''));
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
    const [year, month, day] = text.split('-');
    return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
  }
  if (/^\d{1,2}-\d{1,2}$/.test(text)) {
    const [month, day] = text.split('-');
    return `${currentYear}-${padDatePart(month)}-${padDatePart(day)}`;
  }
  return null;
}

function parseDateExpression(field: string, expression: string, currentYear: number): SearchDateFilter | null {
  const text = normalizeSearchExpression(expression).replace(/\s+/g, '');
  if (!text) return null;
  const rangeParts = text.split(/[~～]/);
  if (rangeParts.length === 2) {
    const start = parseSearchDate(rangeParts[0], currentYear);
    const end = parseSearchDate(rangeParts[1], currentYear);
    return start && end ? { field, operator: 'range', value: start, endValue: end } : null;
  }
  const comparison = text.match(/^(>=|<=)(.+)$/);
  if (comparison) {
    const date = parseSearchDate(comparison[2], currentYear);
    if (!date) return null;
    return { field, operator: comparison[1] === '>=' ? 'gte' : 'lte', value: date };
  }
  const date = parseSearchDate(text, currentYear);
  return date ? { field, operator: 'eq', value: date } : null;
}

function resolveDateField(label: string, aliases: SearchDateAliasMap = {}): string {
  const normalized = String(label || '').trim();
  const lower = normalized.toLowerCase();
  return aliases[normalized] || aliases[lower] || normalized;
}

function hasDateAlias(label: string, aliases: SearchDateAliasMap = {}): boolean {
  const normalized = String(label || '').trim();
  const lower = normalized.toLowerCase();
  return Object.prototype.hasOwnProperty.call(aliases, normalized)
    || Object.prototype.hasOwnProperty.call(aliases, lower);
}

function resolveFieldAlias(label: string, aliases: SearchFieldAliasMap = {}): string {
  const normalized = String(label || '').trim();
  const lower = normalized.toLowerCase();
  return aliases[normalized] || aliases[lower] || '';
}

function parseSearchToken(token: string, options: Required<Pick<ParseSearchQueryOptions, 'currentYear' | 'enableBareDate'>> & ParseSearchQueryOptions): { text?: string; date?: SearchDateFilter; field?: SearchFieldFilter } {
  const colonIndex = token.indexOf(':');
  const fullWidthColonIndex = token.indexOf('：');
  const delimiterIndex = colonIndex > 0
    ? colonIndex
    : fullWidthColonIndex > 0
      ? fullWidthColonIndex
      : -1;
  if (delimiterIndex > 0) {
    const label = token.slice(0, delimiterIndex).trim();
    const expression = token.slice(delimiterIndex + 1).trim();
    const hasScopedDateAliases = !!options.dateAliases;
    if (!hasScopedDateAliases || hasDateAlias(label, options.dateAliases)) {
      const field = resolveDateField(label, options.dateAliases);
      const date = parseDateExpression(field, expression, options.currentYear);
      if (date) return { date };
    }
    const field = resolveFieldAlias(label, options.fieldAliases);
    if (field && expression) return { field: { field, value: normalizeSearchValue(expression) } };
  }
  if (options.enableBareDate && options.defaultDateField) {
    const date = parseDateExpression(options.defaultDateField, token, options.currentYear);
    if (date) return { date };
  }
  return { text: token };
}

function parseSearchQuery(query: unknown, options: ParseSearchQueryOptions = {}): ParsedSearchQuery {
  const raw = String(query || '').trim();
  const currentYear = options.currentYear || DEFAULT_CURRENT_YEAR;
  const enableBareDate = options.enableBareDate !== false;
  const parsed: ParsedSearchQuery = { raw, textTokens: [], dateFilters: [], fieldFilters: [] };
  if (!raw) return parsed;
  raw.split(/\s+/).filter(Boolean).forEach(token => {
    const result = parseSearchToken(token, { ...options, currentYear, enableBareDate });
    if (result.date) parsed.dateFilters.push(result.date);
    else if (result.field) parsed.fieldFilters.push(result.field);
    else if (result.text) parsed.textTokens.push(normalizeSearchValue(result.text));
  });
  return parsed;
}

function normalizeComparableDate(value: unknown): string {
  const text = String(value || '').trim();
  const parsed = parseSearchDate(text, DEFAULT_CURRENT_YEAR);
  return parsed || text.slice(0, 10);
}

function matchesDateFilter(value: unknown, filter: SearchDateFilter): boolean {
  const date = normalizeComparableDate(value);
  if (!date) return false;
  if (filter.operator === 'eq') return date === filter.value;
  if (filter.operator === 'gte') return date >= filter.value;
  if (filter.operator === 'lte') return date <= filter.value;
  return date >= filter.value && date <= (filter.endValue || filter.value);
}

function matchesParsedSearchQuery<T>({ query, record, getText, getDate, getFieldText }: SearchableRecordOptions<T>): boolean {
  const haystack = normalizeSearchValue(getText(record).join(' '));
  const textMatched = query.textTokens.every(token => haystack.includes(token));
  if (!textMatched) return false;
  const fieldMatched = query.fieldFilters.every(filter => {
    if (typeof getFieldText !== 'function') return false;
    const fieldHaystack = normalizeSearchValue(getFieldText(record, filter.field).join(' '));
    return fieldHaystack.includes(filter.value);
  });
  if (!fieldMatched) return false;
  return query.dateFilters.every(filter => matchesDateFilter(getDate(record, filter.field), filter));
}

export {
  DEFAULT_CURRENT_YEAR,
  getCurrentSearchYear,
  matchesDateFilter,
  matchesParsedSearchQuery,
  normalizeSearchValue,
  parseSearchDate,
  parseSearchQuery
};
export type {
  ParsedSearchQuery,
  ParseSearchQueryOptions,
  SearchDateFilter,
  SearchFieldFilter,
  SearchDateOperator
};
