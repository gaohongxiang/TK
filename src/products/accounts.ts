function normalizeAccountName(value) {
  return String(value || '').trim();
}

function toAccountSlot(value, unassignedSlot = '__unassigned__') {
  const normalized = normalizeAccountName(value);
  return normalized || unassignedSlot;
}

function uniqueAccounts(values = []) {
  const seen = new Set();
  const result = [];
  values.forEach(value => {
    const normalized = normalizeAccountName(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function getAllProductAccounts({ accounts = [], products = [] } = {}) {
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
