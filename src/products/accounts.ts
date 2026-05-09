import type { ProductRecord } from './types.ts';

function normalizeAccountName(value: unknown): string {
  return String(value || '').trim();
}

function toAccountSlot(value: unknown, unassignedSlot = '__unassigned__'): string {
  const normalized = normalizeAccountName(value);
  return normalized || unassignedSlot;
}

function uniqueAccounts(values: unknown[] = []): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach(value => {
    const normalized = normalizeAccountName(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function getAllProductAccounts({ accounts = [], products = [] }: {
  accounts?: unknown[];
  products?: ProductRecord[];
} = {}): string[] {
  return uniqueAccounts([
    ...accounts,
    ...products.map(product => product?.accountName)
  ]);
}

const ProductLibraryAccounts = {
  getAllProductAccounts,
  normalizeAccountName,
  toAccountSlot,
  uniqueAccounts
};

export {
  ProductLibraryAccounts,
  getAllProductAccounts,
  normalizeAccountName,
  toAccountSlot,
  uniqueAccounts
};
