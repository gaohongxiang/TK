import { Copy, ExternalLink, Pencil, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ProductRecord, ProductSku, ProductsTableRenderOptions } from './types';

function getProductKey(product: ProductRecord) {
  return String(product?.tkId || product?.name || '').trim();
}

function getImageAlt(product: ProductRecord) {
  return String(product?.name || product?.tkId || '商品图片');
}

function ProductPager({
  pageSize,
  currentPage,
  totalPages,
  pageSizeOptions,
  onPageSizeChange,
  onPageChange,
  compact = false
}: {
  pageSize: number;
  currentPage: number;
  totalPages: number;
  pageSizeOptions: number[];
  onPageSizeChange?: (value: string | number) => void;
  onPageChange?: (delta: number, totalPages?: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={`ot-table-pagination products-react-pager${compact ? ' is-compact' : ''}`}>
      <label className="ot-page-size">
        <span>每页</span>
        <span className="ot-page-size-control">
          <select value={pageSize} onChange={event => onPageSizeChange?.(event.target.value)}>
            {pageSizeOptions.map(size => (
              <option value={size} key={size}>{size}</option>
            ))}
          </select>
        </span>
      </label>
      <button className="btn sm" type="button" disabled={currentPage <= 1} onClick={() => onPageChange?.(-1, totalPages)}>上一页</button>
      <span className="ot-page-indicator">{currentPage} / {totalPages}</span>
      <button className="btn sm" type="button" disabled={currentPage >= totalPages} onClick={() => onPageChange?.(1, totalPages)}>下一页</button>
    </div>
  );
}

function ProductToolbar({
  searchQuery,
  pageSize,
  currentPage,
  totalPages,
  pageSizeOptions,
  onSearchChange,
  onPageSizeChange,
  onPageChange
}: ProductsTableRenderOptions & { currentPage: number; totalPages: number; pageSize: number }) {
  const [composing, setComposing] = useState(false);
  return (
    <div className="ot-table-toolbar ot-sticky-controls pl-sticky-controls products-react-toolbar">
      <div className="ot-sticky-controls-inner products-react-toolbar-inner">
        <div className="ot-table-toolbar-left">
          <label className="ot-table-search products-react-search">
            <span className="ot-table-search-icon" aria-hidden="true"><Search size={15} strokeWidth={2} /></span>
            <input
              id="pl-table-search-input"
              type="text"
              placeholder=" "
              value={searchQuery || ''}
              autoComplete="off"
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={event => {
                setComposing(false);
                onSearchChange?.(event.currentTarget.value);
              }}
              onChange={event => {
                if (!composing) onSearchChange?.(event.currentTarget.value);
              }}
            />
            <span className="ot-table-search-hint">搜索 TK ID / 名称 / 1688 链接</span>
          </label>
        </div>
        <div className="ot-table-toolbar-right">
          <ProductPager
            pageSize={pageSize}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSizeOptions={pageSizeOptions || []}
            onPageSizeChange={onPageSizeChange}
            onPageChange={onPageChange}
          />
        </div>
      </div>
    </div>
  );
}

function ProductFooterToolbar(props: ProductsTableRenderOptions & { currentPage: number; totalPages: number; pageSize: number }) {
  return (
    <div className="ot-table-toolbar ot-table-toolbar-bottom products-react-footer-toolbar">
      <div className="ot-sticky-controls-inner">
        <div />
        <div className="ot-table-toolbar-right">
          <ProductPager
            compact
            pageSize={props.pageSize}
            currentPage={props.currentPage}
            totalPages={props.totalPages}
            pageSizeOptions={props.pageSizeOptions || []}
            onPageSizeChange={props.onPageSizeChange}
            onPageChange={props.onPageChange}
          />
        </div>
      </div>
    </div>
  );
}

function ProductEmptyState({
  hasQuery,
  activeAccount
}: {
  hasQuery: boolean;
  activeAccount?: string;
}) {
  const message = hasQuery
    ? '没有匹配的商品'
    : activeAccount && activeAccount !== '__all__'
      ? `账号「${activeAccount}」下还没有商品`
      : '还没有商品资料';
  return (
    <div className="ot-empty products-react-empty">
      <div>{message}</div>
      <span>{hasQuery ? '试试更换关键词' : '点击右上角「+ 新增商品」开始记录'}</span>
    </div>
  );
}

function ProductImage({ product }: { product: ProductRecord }) {
  const src = String(product?.imageUrl || '').trim();
  if (!src) return <span className="pl-image-placeholder products-react-image-placeholder">-</span>;
  return <img src={src} alt={getImageAlt(product)} className="pl-image products-react-image" />;
}

function SkuExpandedTable({
  product,
  skus,
  helpers
}: {
  product: ProductRecord;
  skus: ProductSku[];
  helpers: ProductsTableRenderOptions['helpers'];
}) {
  return (
    <div className="pl-sku-expanded-surface products-react-sku-surface">
      <div className="pl-sku-expanded-head">
        <div className="pl-sku-expanded-title">SKU 规格明细</div>
        <div className="pl-sku-expanded-copy">订单选择商品时会优先使用这里的 SKU 参数。</div>
      </div>
      <div className="pl-sku-expanded-table-wrap">
        <table className="pl-sku-expanded-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>重量(g)</th>
              <th>尺寸(cm)</th>
              <th>预估海外运费</th>
            </tr>
          </thead>
          <tbody>
            {skus.map(sku => {
              const merged = helpers.mergeProductSku(product, sku);
              return (
                <tr key={String(sku.skuId || sku.skuName || helpers.formatSkuLabel(sku))}>
                  <td><div className="pl-sku-expanded-sku-main">{helpers.formatSkuLabel(sku)}</div></td>
                  <td>{helpers.formatWeight(merged?.weightG)}</td>
                  <td>{helpers.formatSize(merged)}</td>
                  <td>{helpers.formatSkuShippingFee(product, sku)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductTableBody({
  products,
  activeAccount,
  sortOrder,
  totalDisplayed,
  startIndex,
  expandedTkIds,
  helpers,
  onToggleExpand,
  onCopyLink,
  onEdit,
  onDelete
}: ProductsTableRenderOptions & {
  products: ProductRecord[];
  totalDisplayed: number;
  startIndex: number;
}) {
  const showAccount = activeAccount === '__all__';
  const columnCount = 8 + (showAccount ? 1 : 0);

  return (
    <>
      {products.map((product, index) => {
        const tkId = getProductKey(product);
        const absoluteIndex = startIndex + index;
        const seqNum = sortOrder === 'desc' ? totalDisplayed - absoluteIndex : absoluteIndex + 1;
        const skus = helpers.getProductSkus(product);
        const isExpandable = skus.length > 1;
        const isExpanded = !!expandedTkIds?.[tkId];
        const link1688 = String(product?.link1688 || '').trim();
        return (
          <tbody key={tkId || index}>
            <tr
              className={`pl-product-row products-react-row${isExpandable ? ' is-expandable' : ''}${isExpanded ? ' is-expanded' : ''}`}
              data-toggle-expand={isExpandable ? tkId : undefined}
              onClick={event => {
                if (!isExpandable) return;
                if ((event.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
                onToggleExpand?.(tkId);
              }}
            >
              <td className="mono">
                <div className="pl-row-seq">
                  <span>{seqNum}</span>
                  {isExpandable ? <span className="pl-expand-caret" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span> : null}
                </div>
              </td>
              <td className="pl-image-cell"><ProductImage product={product} /></td>
              {showAccount ? <td><span className="chip muted products-react-account-chip">{helpers.formatText(product?.accountName)}</span></td> : null}
              <td className="mono products-react-id">{helpers.formatText(product?.tkId)}</td>
              <td className="products-react-name-cell"><div>{helpers.formatText(product?.name)}</div></td>
              <td><span className="products-react-cargo">{helpers.getCargoTypeLabel(helpers.getProductDefaults(product)?.cargoType)}</span></td>
              <td>
                <span className={`pl-sku-count-pill${isExpandable ? ' is-expandable' : ''}`} title={isExpandable ? '点击展开 SKU 明细' : undefined}>
                  {helpers.formatSkuCount(product)}
                </span>
              </td>
              <td>
                {link1688 ? (
                  <div className="pl-link-actions products-react-link-actions">
                    <a className="btn sm icon-btn" href={link1688} target="_blank" rel="noreferrer" title="打开 1688 链接" aria-label="打开 1688 链接">
                      <ExternalLink size={14} strokeWidth={2} />
                    </a>
                    <button className="btn sm icon-btn" type="button" data-copy-link={link1688} title="复制 1688 链接" aria-label="复制 1688 链接" onClick={() => onCopyLink?.(link1688)}>
                      <Copy size={14} strokeWidth={2} />
                    </button>
                  </div>
                ) : '-'}
              </td>
              <td>
                <div className="products-react-actions">
                  <button className="btn sm icon-btn" type="button" data-edit={tkId} title="编辑商品" aria-label="编辑商品" onClick={() => onEdit?.(tkId)}>
                    <Pencil size={14} strokeWidth={2} />
                  </button>
                  <button className="btn sm danger icon-btn" type="button" data-del={tkId} title="删除商品" aria-label="删除商品" onClick={() => onDelete?.(tkId)}>
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              </td>
            </tr>
            {isExpandable && isExpanded ? (
              <tr className="pl-sku-detail-row products-react-sku-detail-row">
                <td colSpan={columnCount}>
                  <SkuExpandedTable product={product} skus={skus} helpers={helpers} />
                </td>
              </tr>
            ) : null}
          </tbody>
        );
      })}
    </>
  );
}

function ProductsTable(options: ProductsTableRenderOptions) {
  const {
    products = [],
    activeAccount = '__all__',
    searchQuery = '',
    sortOrder = 'asc',
    pageSize = 50,
    currentPage = 1,
    pageSizeOptions = [],
    helpers,
    onSortToggle
  } = options;
  const displayed = useMemo(() => helpers.deriveDisplayedProducts({
    products,
    activeAccount,
    searchQuery,
    sortOrder
  }), [activeAccount, helpers, products, searchQuery, sortOrder]);
  const pageState = helpers.clampPage(currentPage, pageSize, displayed.length);
  const startIndex = (pageState.currentPage - 1) * pageState.pageSize;
  const paged = displayed.slice(startIndex, startIndex + pageState.pageSize);
  const sortIcon = sortOrder === 'asc' ? '↑' : '↓';
  const sortTitle = sortOrder === 'asc' ? '当前正序，点击切换' : '当前倒序，点击切换';
  const showAccount = activeAccount === '__all__';
  const hasQuery = String(searchQuery || '').trim().length > 0;

  return (
    <div className="products-react-table-shell" data-react-products-table-ready="true">
      {!displayed.length ? (
        <ProductEmptyState hasQuery={hasQuery} activeAccount={activeAccount} />
      ) : (
        <div className="ot-table-inner products-react-table-inner">
          <table className={`ot pl-table products-react-table${showAccount ? ' is-all-accounts' : ' is-account-scoped'}`}>
            <colgroup>
              <col className="products-react-col-seq" />
              <col className="products-react-col-image" />
              {showAccount ? <col className="products-react-col-account" /> : null}
              <col className="products-react-col-id" />
              <col className="products-react-col-name" />
              <col className="products-react-col-cargo" />
              <col className="products-react-col-sku" />
              <col className="products-react-col-link" />
              <col className="products-react-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>
                  <button id="pl-sort-btn" className="products-react-sort" type="button" title={sortTitle} onClick={() => onSortToggle?.()}>
                    # {sortIcon}
                  </button>
                </th>
                <th>图片</th>
                {showAccount ? <th>账号</th> : null}
                <th>TK ID</th>
                <th>商品名称</th>
                <th>货物类型</th>
                <th>SKU数</th>
                <th>1688</th>
                <th>操作</th>
              </tr>
            </thead>
            <ProductTableBody {...options} products={paged} totalDisplayed={displayed.length} startIndex={startIndex} />
          </table>
        </div>
      )}
    </div>
  );
}

export {
  ProductFooterToolbar,
  ProductToolbar,
  ProductsTable
};
