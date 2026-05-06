import { createRoot, type Root } from 'react-dom/client';
import { ProductFooterToolbar, ProductToolbar, ProductsTable } from './ProductsTable';
import type { ProductsTableRenderOptions } from './types';

const roots = new WeakMap<Element, Root>();

function getRoot(element: Element) {
  let root = roots.get(element);
  if (!root) {
    root = createRoot(element);
    roots.set(element, root);
  }
  return root;
}

function renderInto(element: HTMLElement | null | undefined, node: React.ReactNode) {
  if (!element) return;
  getRoot(element).render(node);
}

function mountProductsTable(options: ProductsTableRenderOptions) {
  const products = Array.isArray(options.products) ? options.products : [];
  const activeAccount = options.activeAccount || '__all__';
  const searchQuery = options.searchQuery || '';
  const sortOrder = options.sortOrder || 'asc';
  const pageSize = Math.max(1, Number(options.pageSize) || 50);
  const displayed = options.helpers.deriveDisplayedProducts({
    products,
    activeAccount,
    searchQuery,
    sortOrder
  });
  const pageState = options.helpers.clampPage(Number(options.currentPage) || 1, pageSize, displayed.length);
  const props = {
    ...options,
    products,
    activeAccount,
    searchQuery,
    sortOrder,
    pageSize: pageState.pageSize,
    currentPage: pageState.currentPage,
    pageSizeOptions: options.pageSizeOptions || []
  };

  renderInto(options.toolbar, <ProductToolbar {...props} totalPages={pageState.totalPages} />);
  renderInto(options.wrap, <ProductsTable {...props} />);
  renderInto(options.footerToolbar, <ProductFooterToolbar {...props} totalPages={pageState.totalPages} />);
}

export { mountProductsTable };
