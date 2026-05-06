import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Copy, ExternalLink, Pencil, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
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
    <div className={cn('ot-table-pagination products-react-pager inline-flex items-center gap-2 flex-wrap', compact ? 'is-compact' : '')}>
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
      <Button size="sm" disabled={currentPage <= 1} onClick={() => onPageChange?.(-1, totalPages)}>上一页</Button>
      <span className="ot-page-indicator">{currentPage} / {totalPages}</span>
      <Button size="sm" disabled={currentPage >= totalPages} onClick={() => onPageChange?.(1, totalPages)}>下一页</Button>
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
    <div className="ot-table-toolbar ot-sticky-controls pl-sticky-controls products-react-toolbar mt-[14px]">
      <div className="ot-sticky-controls-inner products-react-toolbar-inner gap-3 max-[640px]:gap-2.5 max-[900px]:items-start">
        <div className="ot-table-toolbar-left">
          <label className="ot-table-search products-react-search w-full max-w-[520px]">
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
    <div className="ot-table-toolbar ot-table-toolbar-bottom products-react-footer-toolbar mt-3">
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
    <div className="ot-empty products-react-empty min-h-[180px]">
      <div className="mb-1.5 text-[15px]">{message}</div>
      <span className="text-[12.5px] text-[var(--muted)]">{hasQuery ? '试试更换关键词' : '点击右上角「+ 新增商品」开始记录'}</span>
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
        <Table className="pl-sku-expanded-table">
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>重量(g)</TableHead>
              <TableHead>尺寸(cm)</TableHead>
              <TableHead>预估海外运费</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skus.map(sku => {
              const merged = helpers.mergeProductSku(product, sku);
              return (
                <TableRow key={String(sku.skuId || sku.skuName || helpers.formatSkuLabel(sku))}>
                  <TableCell><div className="pl-sku-expanded-sku-main">{helpers.formatSkuLabel(sku)}</div></TableCell>
                  <TableCell>{helpers.formatWeight(merged?.weightG)}</TableCell>
                  <TableCell>{helpers.formatSize(merged)}</TableCell>
                  <TableCell>{helpers.formatSkuShippingFee(product, sku)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
          <TableBody key={tkId || index}>
            <TableRow
              className={cn(
                'pl-product-row products-react-row bg-[color-mix(in_srgb,var(--panel)_98%,white)]',
                isExpandable ? 'is-expandable' : '',
                isExpanded ? 'is-expanded' : ''
              )}
              data-toggle-expand={isExpandable ? tkId : undefined}
              onClick={event => {
                if (!isExpandable) return;
                if ((event.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
                onToggleExpand?.(tkId);
              }}
            >
              <TableCell className="mono">
                <div className="pl-row-seq">
                  <span>{seqNum}</span>
                  {isExpandable ? <span className="pl-expand-caret" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span> : null}
                </div>
              </TableCell>
              <TableCell className="pl-image-cell"><ProductImage product={product} /></TableCell>
              {showAccount ? <TableCell><span className="chip muted products-react-account-chip">{helpers.formatText(product?.accountName)}</span></TableCell> : null}
              <TableCell className="mono products-react-id min-w-[150px] max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap text-center font-normal">{helpers.formatText(product?.tkId)}</TableCell>
              <TableCell className="products-react-name-cell">
                <div className="mx-auto w-max max-w-[clamp(240px,30vw,420px)] overflow-hidden text-ellipsis whitespace-nowrap text-center font-normal text-[var(--text)]">
                  {helpers.formatText(product?.name)}
                </div>
              </TableCell>
              <TableCell><span className="products-react-cargo inline-flex min-h-[26px] items-center whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--border)_86%,white)] bg-[color-mix(in_srgb,var(--panel2)_76%,white)] px-[9px] text-xs text-[var(--muted)]">{helpers.getCargoTypeLabel(helpers.getProductDefaults(product)?.cargoType)}</span></TableCell>
              <TableCell>
                <span className={`pl-sku-count-pill${isExpandable ? ' is-expandable' : ''}`} title={isExpandable ? '点击展开 SKU 明细' : undefined}>
                  {helpers.formatSkuCount(product)}
                </span>
              </TableCell>
              <TableCell>
                {link1688 ? (
                  <div className="pl-link-actions products-react-link-actions min-w-max justify-center">
                    <Button asChild size="smIcon" title="打开 1688 链接" aria-label="打开 1688 链接">
                      <a href={link1688} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} strokeWidth={2} />
                      </a>
                    </Button>
                    <Button size="smIcon" data-copy-link={link1688} title="复制 1688 链接" aria-label="复制 1688 链接" onClick={() => onCopyLink?.(link1688)}>
                      <Copy size={14} strokeWidth={2} />
                    </Button>
                  </div>
                ) : '-'}
              </TableCell>
              <TableCell>
                <div className="products-react-actions flex items-center justify-center gap-1.5">
                  <Button size="smIcon" data-edit={tkId} title="编辑商品" aria-label="编辑商品" onClick={() => onEdit?.(tkId)}>
                    <Pencil size={14} strokeWidth={2} />
                  </Button>
                  <Button size="smIcon" variant="danger" data-del={tkId} title="删除商品" aria-label="删除商品" onClick={() => onDelete?.(tkId)}>
                    <Trash2 size={14} strokeWidth={2} />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            {isExpandable && isExpanded ? (
              <TableRow className="pl-sku-detail-row products-react-sku-detail-row">
                <TableCell colSpan={columnCount}>
                  <SkuExpandedTable product={product} skus={skus} helpers={helpers} />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
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
    <div className="products-react-table-shell min-w-0" data-react-products-table-ready="true">
      {!displayed.length ? (
        <ProductEmptyState hasQuery={hasQuery} activeAccount={activeAccount} />
      ) : (
        <div className="ot-table-inner products-react-table-inner rounded-none border-0 bg-transparent">
          <Table className={`pl-table products-react-table table-auto${showAccount ? ' is-all-accounts' : ' is-account-scoped'}`}>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button id="pl-sort-btn" variant="plain" className="products-react-sort" title={sortTitle} onClick={() => onSortToggle?.()}>
                    # {sortIcon}
                  </Button>
                </TableHead>
                <TableHead>图片</TableHead>
                {showAccount ? <TableHead>账号</TableHead> : null}
                <TableHead>TK ID</TableHead>
                <TableHead>商品名称</TableHead>
                <TableHead>货物类型</TableHead>
                <TableHead>SKU数</TableHead>
                <TableHead>1688</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <ProductTableBody {...options} products={paged} totalDisplayed={displayed.length} startIndex={startIndex} />
          </Table>
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
