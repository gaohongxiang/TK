import { Alert, AlertDescription } from '@/components/ui/alert';
import { AccountDeleteDialog, AccountEditDialog } from '@/components/ui/account-manage-dialogs';
import { AccountTabsBar } from '@/components/ui/account-tabs-bar';
import { AddAccountDialog } from '@/components/ui/add-account-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ExportOptions } from '@/components/ui/export-options';
import { FormField, FormRow } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ModuleListState } from '@/components/ui/module-list-state';
import { PageHero } from '@/components/ui/page-hero';
import { SearchHelpButton } from '@/components/ui/search-help';
import { Select } from '@/components/ui/select';
import { refreshButtonClass, statusStripClass, statusStripLeftClass, statusStripRightClass, syncStatusClass } from '@/components/ui/status-strip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableFrame, TablePager, TableSearch, TableSortButton, TableToolbar, TableViewport } from '@/components/ui/table-tools';
import { Textarea } from '@/components/ui/textarea';
import { showAppToast, type ToastType } from '@/app/toast';
import { TKFirestoreConnection } from '../../../firestore-connection.ts';
import {
  formatFirestoreRulesUpdateMessage,
  isPermissionDenied
} from '../../../firestore-rules-compatibility.ts';
import { ProductLibraryProviderFirestore } from '../../../products/provider-firestore.ts';
import { ProductLibraryExport, csvEscape } from '../../../products/export.ts';
import {
  normalizeAccountName,
  toAccountSlot,
  uniqueAccounts
} from '../../../products/accounts.ts';
import {
  buildBatchSkuDrafts,
  buildEstimatedShippingSnapshot,
  formatSizeInput,
  matchesBatchSkuName,
  resolveProductDimensions,
  skuUsesProductDefaults
} from '../../../products/form-utils.ts';
import { ProductLibraryTable } from '../../../products/table.ts';
import { ensureGlobalSettingsStore } from '../../../global-settings.ts';
import { TKShippingCore } from '../../../shipping-core.ts';
import {
  Copy,
  ExternalLink,
  FileDown,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ProductProviderDeferredWrite, ProductRecord, ProductSku } from '../../../products/types.ts';

type ProductDraftSku = ProductSku & {
  sizeText?: string;
};

type ProductFormDraft = {
  accountName: string;
  tkId: string;
  name: string;
  note: string;
  link1688: string;
  imageUrl: string;
  cargoType: string;
  matchText: string;
  defaultWeightG: string;
  defaultSizeText: string;
  axisA: string;
  axisB: string;
  axisC: string;
  skus: ProductDraftSku[];
};

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];
const ACCOUNT_UPDATED_EVENT = 'tk-accounts-changed';
const modalCopyClass = 'mb-4 text-[13px] leading-[1.75] text-[var(--muted)]';
const productSkuPanelClass = 'pl-sku-panel mt-4 rounded-[14px] border border-[color-mix(in_srgb,var(--border)_88%,white)] bg-[color-mix(in_srgb,var(--panel)_92%,white)] px-4 py-3.5';
const productSkuHeaderClass = 'pl-sku-header flex items-start justify-between gap-3';
const productSkuTitleClass = 'pl-sku-title text-sm font-bold text-[var(--text)]';
const productSkuCopyClass = 'pl-sku-copy mt-1 text-xs leading-[1.55] text-[var(--muted)]';
const productSkuActionsClass = 'pl-sku-actions mt-3 flex justify-start gap-2';
const productSkuBatchToolsClass = 'pl-sku-batch-tools mt-3 rounded-xl border border-[color-mix(in_srgb,var(--border)_88%,white)] bg-[color-mix(in_srgb,var(--panel2)_56%,white)] px-3.5 py-3';
const productSkuBatchBlockClass = 'pl-sku-batch-block';
const productSkuBatchTitleClass = 'pl-sku-batch-title text-[12.5px] font-bold text-[var(--text)]';
const productSkuBatchCopyClass = 'pl-sku-batch-copy mt-1 text-xs leading-[1.55] text-[var(--muted)]';
const productSkuBatchRowClass = 'triple pl-sku-batch-row mt-2.5';
const productSkuBatchActionsClass = 'pl-sku-batch-actions mt-2.5 flex justify-end';
const productSkuParameterPanelClass = 'pl-sku-parameter-panel mt-3 rounded-xl border border-[color-mix(in_srgb,var(--border)_88%,white)] bg-[color-mix(in_srgb,var(--panel2)_34%,white)] px-3.5 py-3';
const productSkuSetupBlockClass = 'pl-sku-setup-block pl-sku-setup-block-single mt-3 min-w-0';
const productSkuSetupSurfaceClass = 'pl-sku-setup-surface rounded-[14px] border border-[color-mix(in_srgb,var(--border)_86%,white)] bg-[linear-gradient(180deg,rgba(110,168,255,.06),rgba(138,255,207,.035))] px-4 py-3.5';
const productSkuCountPillClass = 'pl-sku-count-pill inline-flex min-h-7 items-center rounded-full border border-[color-mix(in_srgb,var(--border)_88%,white)] bg-[color-mix(in_srgb,var(--panel2)_90%,white)] px-2.5 text-xs font-semibold text-[var(--text)]';
const productSkuCountExpandableClass = 'is-expandable border-[color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_8%,white)]';
const productSkuDetailCellClass = 'px-4 pb-4 pt-0 !border-t-0 bg-[color-mix(in_srgb,var(--accent)_2%,white)]';
const productSkuExpandedSurfaceClass = 'pl-sku-expanded-surface products-react-sku-surface -mt-px rounded-b-2xl border border-t-0 border-[color-mix(in_srgb,var(--border)_88%,white)] bg-[linear-gradient(180deg,rgba(110,168,255,.05),rgba(138,255,207,.03))] px-4 pb-4 pt-3.5';
const productSkuExpandedHeadClass = 'pl-sku-expanded-head mb-3 flex items-start justify-between gap-3';
const productSkuExpandedTitleClass = 'pl-sku-expanded-title text-[13px] font-bold text-[var(--text)]';
const productSkuExpandedCopyClass = 'pl-sku-expanded-copy text-xs leading-normal text-[var(--muted)]';
const productSkuExpandedTableWrapClass = 'pl-sku-expanded-table-wrap overflow-x-auto rounded-xl border border-[color-mix(in_srgb,var(--border)_88%,white)] bg-[color-mix(in_srgb,white_72%,var(--panel2))]';
const productSkuExpandedTableClass = 'pl-sku-expanded-table min-w-[560px] w-full border-collapse';
const productSkuExpandedHeadCellClass = 'border-b border-[color-mix(in_srgb,var(--border)_88%,white)] bg-[color-mix(in_srgb,var(--panel)_86%,white)] px-2.5 py-[7px] text-left align-middle text-[11px] font-normal uppercase tracking-[.08em] text-[var(--muted)]';
const productSkuExpandedCellClass = 'border-b border-[color-mix(in_srgb,var(--border)_88%,white)] px-2.5 py-[7px] text-left align-middle text-[12.5px]';
const productSkuExpandedSkuMainClass = 'pl-sku-expanded-sku-main font-semibold text-[var(--text)]';
const productSkuEmptyClass = 'pl-sku-empty px-1 pb-0.5 pt-3 text-[12.5px] text-[var(--muted)]';
const productSkuFeeStackClass = 'pl-sku-fee-stack flex flex-col items-center gap-0.5 text-center';
const productSkuFeeValueClass = 'pl-sku-fee-value text-[13px] font-bold text-[var(--text)]';
const productSkuFeeSubClass = 'pl-sku-fee-sub text-[11px] leading-[1.35] text-[var(--muted)] empty:hidden';
const productSkuFeeNoteClass = 'pl-sku-fee-note text-[11px] leading-[1.35] text-[var(--expense)] empty:hidden';
const productSkuActionsCellClass = 'pl-sku-cell-actions w-[72px] text-right';
const productTableClass = 'pl-table products-react-table mt-1.5 min-w-[1100px] text-[13px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap [&_tbody_tr:hover]:bg-[rgba(110,168,255,.05)] max-[768px]:text-[13px] max-[768px]:[&_td]:px-1.5 max-[768px]:[&_td]:py-[9px] max-[768px]:[&_th]:px-1.5 max-[768px]:[&_th]:py-[9px] max-[768px]:[&_th]:text-[10.5px]';
const productSeqClass = 'pl-row-seq inline-flex items-center justify-center gap-2';
const productExpandCaretClass = 'pl-expand-caret text-xs leading-none text-[var(--muted)]';
const productImageCellClass = 'pl-image-cell w-[74px]';
const productImageClass = 'pl-image products-react-image h-12 w-12 rounded-[10px] border border-[var(--border)] bg-[var(--panel2)] object-cover';
const productImagePlaceholderClass = 'pl-image-placeholder products-react-image-placeholder inline-flex h-12 w-12 items-center justify-center rounded-[10px] border border-dashed border-[var(--border)] text-[var(--muted)]';
const productIdCellClass = 'products-react-id min-w-[170px] tabular-nums';
const productNameCellClass = 'products-react-name-cell min-w-[170px] max-w-[260px]';
const productNameTextClass = 'block truncate';
const productNoteCellClass = 'products-react-note-cell min-w-[150px] max-w-[230px]';
const productNoteTextClass = 'block truncate text-[12.5px] text-[var(--muted)]';
const productLinkCellClass = 'products-react-link-cell w-[104px] min-w-[104px]';
const productActionsCellClass = 'products-react-actions-cell w-[104px] min-w-[104px]';
const productLinkActionsClass = 'pl-link-actions products-react-link-actions inline-flex min-w-[78px] items-center justify-between gap-3';
const productActionsClass = 'products-react-actions inline-flex min-w-[78px] items-center justify-between gap-3';
const productRowClass = 'pl-product-row products-react-row [&.is-expandable]:cursor-pointer [&.is-expandable_td]:transition-[background-color] [&.is-expandable_td]:duration-150 [&.is-expanded_td]:bg-[rgba(110,168,255,.045)]';
const productSkuListClass = 'pl-sku-list mt-3.5';
const productSkuEditWrapClass = 'pl-sku-table-wrap overflow-x-auto border-t border-[color-mix(in_srgb,var(--border)_88%,white)]';
const productSkuEditTableClass = 'pl-sku-edit-table min-w-[820px] table-fixed overflow-hidden rounded-xl border-collapse';
const productSkuEditHeadCellClass = 'border-b border-[color-mix(in_srgb,var(--border)_88%,white)] bg-[color-mix(in_srgb,var(--panel2)_45%,white)] px-1.5 py-2.5 text-center align-middle text-[11px] font-bold uppercase tracking-[.08em] text-[var(--muted)]';
const productSkuEditCellClass = 'border-b border-[color-mix(in_srgb,var(--border)_88%,white)] bg-[color-mix(in_srgb,var(--panel)_92%,white)] px-1.5 py-2 text-center align-middle';
const productSkuEditRowClass = 'pl-sku-edit-row hover:[&_td]:bg-[color-mix(in_srgb,var(--accent)_2%,white)] [&.is-inheriting_td]:bg-[color-mix(in_srgb,var(--accent)_3%,white)]';
const EMPTY_PRODUCT_FORM: ProductFormDraft = {
  accountName: '',
  tkId: '',
  name: '',
  note: '',
  link1688: '',
  imageUrl: '',
  cargoType: 'general',
  matchText: '',
  defaultWeightG: '',
  defaultSizeText: '',
  axisA: '',
  axisB: '',
  axisC: '',
  skus: []
};

function generateInternalSkuId() {
  return `sku_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptySku(): ProductDraftSku {
  return {
    skuId: generateInternalSkuId(),
    skuName: '',
    useProductDefaults: true,
    weightG: '',
    sizeText: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    estimatedShippingFee: '',
    chargeWeightKg: '',
    shippingNote: ''
  };
}

function clampPage(currentPage: number, pageSize: number, totalItems: number) {
  const safePageSize = Math.max(1, Number(pageSize) || 50);
  const totalPages = Math.max(1, Math.ceil((totalItems || 0) / safePageSize));
  const nextCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
  return { currentPage: nextCurrentPage, totalPages, pageSize: safePageSize };
}

function readGlobalConfig() {
  return TKFirestoreConnection.getConfig() || null;
}

function showToast(message: string, type: ToastType = 'ok') {
  showAppToast(message, type);
}

function isProductDeferredWrite(value: ProductRecord | ProductProviderDeferredWrite<ProductRecord>): value is ProductProviderDeferredWrite<ProductRecord> {
  return typeof value === 'object' && value !== null && 'commitPromise' in value;
}

function ProductPager({
  pageSize,
  currentPage,
  totalPages,
  onPageSizeChange,
  onPageChange,
  compact = false
}: {
  pageSize: number;
  currentPage: number;
  totalPages: number;
  onPageSizeChange: (value: number) => void;
  onPageChange: (delta: number) => void;
  compact?: boolean;
}) {
  return (
    <TablePager
      className={cn('products-react-pager max-[640px]:w-full max-[640px]:justify-start', compact ? 'is-compact' : '')}
      pageSize={pageSize}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageSizeChange={onPageSizeChange}
      onPageChange={onPageChange}
    />
  );
}

function ProductsTableView({
  products,
  activeAccount,
  searchQuery,
  searchHelpOpen,
  sortOrder,
  pageSize,
  currentPage,
  expandedTkIds,
  onSearchChange,
  onSearchHelpOpenChange,
  onPageSizeChange,
  onPageChange,
  onSortToggle,
  onToggleExpand,
  onCopyLink,
  onEdit,
  onDelete
}: {
  products: ProductRecord[];
  activeAccount: string;
  searchQuery: string;
  searchHelpOpen: boolean;
  sortOrder: string;
  pageSize: number;
  currentPage: number;
  expandedTkIds: Record<string, boolean>;
  onSearchChange: (value: string) => void;
  onSearchHelpOpenChange: (open: boolean) => void;
  onPageSizeChange: (value: number) => void;
  onPageChange: (delta: number) => void;
  onSortToggle: () => void;
  onToggleExpand: (tkId: string) => void;
  onCopyLink: (link: string) => void;
  onEdit: (tkId: string) => void;
  onDelete: (tkId: string) => void;
}) {
  const displayed = useMemo(() => ProductLibraryTable.deriveDisplayedProducts({
    products,
    activeAccount,
    searchQuery,
    sortOrder
  }), [activeAccount, products, searchQuery, sortOrder]);
  const pageState = clampPage(currentPage, pageSize, displayed.length);
  const startIndex = (pageState.currentPage - 1) * pageState.pageSize;
  const paged = displayed.slice(startIndex, startIndex + pageState.pageSize);
  const showAccount = activeAccount === '__all__';
  const sortIcon = sortOrder === 'asc' ? '↑' : '↓';
  const sortTitle = sortOrder === 'asc' ? '当前正序，点击切换' : '当前倒序，点击切换';
  const columnCount = 8 + (showAccount ? 1 : 0);

  return (
    <>
      <TableToolbar
        id="pl-toolbar"
        className="products-react-toolbar"
        innerClassName="products-react-toolbar-inner gap-3 max-[640px]:gap-2.5 max-[900px]:items-start"
        left={(
            <TableSearch
              id="pl-table-search-input"
              className="products-react-search w-full max-w-[520px]"
            hint="文本搜索账号 / TK ID / 商品 / SKU / 1688"
            value={searchQuery}
            onChange={onSearchChange}
            after={(
              <SearchHelpButton
                id="pl-search-help-btn"
                modalId="pl-search-help-modal"
                title="商品搜索说明"
                open={searchHelpOpen}
                onOpenChange={onSearchHelpOpenChange}
                items={[
                  { label: '文本搜索', children: '只做文本搜索，不把 05-18 当日期。' },
                  { label: '可搜字段', children: '账号、TK ID、商品名、备注、1688 链接、货物类型、SKU ID、SKU 名称。' },
                  { label: '例子', children: 'NOMA、雨衣、5834、特货、SKU-01、05-18。' }
                ]}
              />
            )}
          />
        )}
        right={(
          <div className="inline-flex flex-wrap items-center gap-4 max-[768px]:gap-3">
            <TableSortButton id="pl-sort-btn" className="products-react-sort" title={sortTitle} onClick={onSortToggle}>
              排序 {sortIcon}
            </TableSortButton>
            <ProductPager
              pageSize={pageState.pageSize}
              currentPage={pageState.currentPage}
              totalPages={pageState.totalPages}
              onPageSizeChange={onPageSizeChange}
              onPageChange={onPageChange}
            />
          </div>
        )}
      />

      <TableViewport className="products-react-table-wrap products-react-table-shell">
        <div id="pl-table-container" data-react-products-table-ready="true">
          {!displayed.length ? (
            <ModuleListState
              tone="empty"
              className="products-react-empty"
              title={searchQuery.trim()
                ? '没有匹配的商品'
                : activeAccount !== '__all__'
                  ? `账号「${activeAccount}」下还没有商品`
                  : '还没有商品资料'}
              description={searchQuery.trim() ? '试试更换关键词' : '点击右上角「+ 新增商品」开始记录'}
            />
          ) : (
            <TableFrame className="products-react-table-inner min-w-full">
              <Table className={cn(productTableClass, showAccount ? 'is-all-accounts' : 'is-account-scoped')}>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>图片</TableHead>
                  {showAccount ? <TableHead>账号</TableHead> : null}
                  <TableHead>TK ID</TableHead>
                  <TableHead>商品名称</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>货物类型</TableHead>
                  <TableHead>SKU数</TableHead>
                  <TableHead className={productLinkCellClass}>1688</TableHead>
                  <TableHead className={productActionsCellClass}>操作</TableHead>
                </TableRow>
              </TableHeader>
              {paged.map((product, index) => {
                const tkId = String(product?.tkId || '').trim();
                const absoluteIndex = startIndex + index;
                const seqNum = sortOrder === 'desc' ? displayed.length - absoluteIndex : absoluteIndex + 1;
                const skus = ProductLibraryTable.getProductSkus(product);
                const isExpandable = skus.length > 1;
                const isExpanded = !!expandedTkIds[tkId];
                const link1688 = String(product?.link1688 || '').trim();
                const defaults = ProductLibraryTable.getProductDefaults(product);
                return (
                  <TableBody key={tkId || index}>
                    <TableRow
                      className={cn(productRowClass, isExpandable ? 'is-expandable' : '', isExpanded ? 'is-expanded' : '')}
                      data-toggle-expand={isExpandable ? tkId : undefined}
                      onClick={event => {
                        if (!isExpandable) return;
                        if ((event.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
                        onToggleExpand(tkId);
                      }}
                    >
                      <TableCell className="tabular-nums">
                        <div className={productSeqClass}>
                          <span>{seqNum}</span>
                          {isExpandable ? <span className={productExpandCaretClass} aria-hidden="true">{isExpanded ? '▾' : '▸'}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className={productImageCellClass}>
                        {product.imageUrl
                          ? <img src={String(product.imageUrl)} alt={String(product.name || product.tkId || '商品图片')} className={productImageClass} />
                          : <span className={productImagePlaceholderClass}>-</span>}
                      </TableCell>
                      {showAccount ? <TableCell><Badge className="products-react-account-chip">{ProductLibraryTable.formatText(product.accountName)}</Badge></TableCell> : null}
                      <TableCell className={productIdCellClass}>{ProductLibraryTable.formatText(product.tkId)}</TableCell>
                      <TableCell className={productNameCellClass} title={String(product.name || '')}><div className={productNameTextClass}>{ProductLibraryTable.formatText(product.name)}</div></TableCell>
                      <TableCell className={productNoteCellClass} title={String(product.note || '')}>
                        <div className={productNoteTextClass}>{ProductLibraryTable.formatText(product.note)}</div>
                      </TableCell>
                      <TableCell>{ProductLibraryTable.getCargoTypeLabel(defaults?.cargoType)}</TableCell>
                      <TableCell className="products-react-sku-cell min-w-[92px]">
                        <span className={cn(productSkuCountPillClass, isExpandable ? productSkuCountExpandableClass : '')} title={isExpandable ? '点击展开 SKU 明细' : undefined}>
                          {ProductLibraryTable.formatSkuCount(product)}
                        </span>
                      </TableCell>
                      <TableCell className={productLinkCellClass}>
                        {link1688 ? (
                          <div className={productLinkActionsClass}>
                            <Button asChild size="smIcon" title="打开 1688 链接" aria-label="打开 1688 链接">
                              <a href={link1688} target="_blank" rel="noreferrer"><ExternalLink size={14} strokeWidth={2} /></a>
                            </Button>
                            <Button size="smIcon" data-copy-link={link1688} title="复制 1688 链接" aria-label="复制 1688 链接" onClick={() => onCopyLink(link1688)}>
                              <Copy size={14} strokeWidth={2} />
                            </Button>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className={productActionsCellClass}>
                        <div className={productActionsClass}>
                          <Button size="smIcon" data-edit={tkId} title="编辑商品" aria-label="编辑商品" onClick={() => onEdit(tkId)}>
                            <Pencil size={14} strokeWidth={2} />
                          </Button>
                          <Button size="smIcon" variant="danger" data-del={tkId} title="删除商品" aria-label="删除商品" onClick={() => onDelete(tkId)}>
                            <Trash2 size={14} strokeWidth={2} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpandable && isExpanded ? (
                      <TableRow className="pl-sku-detail-row products-react-sku-detail-row">
                        <TableCell className={productSkuDetailCellClass} colSpan={columnCount}>
                          <div className={productSkuExpandedSurfaceClass}>
                            <div className={productSkuExpandedHeadClass}>
                              <div className={productSkuExpandedTitleClass}>SKU 规格明细</div>
                              <div className={productSkuExpandedCopyClass}>订单选择商品时会优先使用这里的 SKU 参数。</div>
                            </div>
                            <div className={productSkuExpandedTableWrapClass}>
                              <Table className={productSkuExpandedTableClass}>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className={productSkuExpandedHeadCellClass}>SKU</TableHead>
                                    <TableHead className={productSkuExpandedHeadCellClass}>重量(g)</TableHead>
                                    <TableHead className={productSkuExpandedHeadCellClass}>尺寸(cm)</TableHead>
                                    <TableHead className={productSkuExpandedHeadCellClass}>预估海外运费</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {skus.map((sku, skuIndex) => {
                                    const merged = ProductLibraryTable.mergeProductSku(product, sku);
                                    const cellClass = cn(productSkuExpandedCellClass, skuIndex === skus.length - 1 ? 'border-b-0' : '');
                                    return (
                                      <TableRow key={String(sku.skuId || sku.skuName)}>
                                        <TableCell className={cellClass}><div className={productSkuExpandedSkuMainClass}>{ProductLibraryTable.formatSkuLabel(sku)}</div></TableCell>
                                        <TableCell className={cellClass}>{ProductLibraryTable.formatWeight(merged?.weightG)}</TableCell>
                                        <TableCell className={cellClass}>{ProductLibraryTable.formatSize(merged)}</TableCell>
                                        <TableCell className={cellClass}>{ProductLibraryTable.formatSkuShippingFee(product, sku)}</TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                );
              })}
              </Table>
            </TableFrame>
          )}
        </div>
      </TableViewport>

      <div id="pl-table-footer-toolbar-container">
        <TableToolbar
          bottom
          className="products-react-footer-toolbar"
          right={(
            <ProductPager
              compact
              pageSize={pageState.pageSize}
              currentPage={pageState.currentPage}
              totalPages={pageState.totalPages}
              onPageSizeChange={onPageSizeChange}
              onPageChange={onPageChange}
            />
          )}
        />
      </div>
    </>
  );
}

function ProductModal({
  open,
  draft,
  accounts,
  editingTkId,
  invalid,
  batchOpen,
  onOpenChange,
  onDraftChange,
  onBatchOpenChange,
  onGenerateSkus,
  onAddSku,
  onRemoveSku,
  onSubmit
}: {
  open: boolean;
  draft: ProductFormDraft;
  accounts: string[];
  editingTkId: string;
  invalid: Set<string>;
  batchOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: ProductFormDraft) => void;
  onBatchOpenChange: (open: boolean) => void;
  onGenerateSkus: () => void;
  onAddSku: () => void;
  onRemoveSku: (index: number) => void;
  onSubmit: () => void;
}) {
  const title = editingTkId ? '编辑商品' : '新增商品';

  function updateField(name: keyof ProductFormDraft, value: string) {
    onDraftChange({ ...draft, [name]: value });
  }

  function updateSku(index: number, patch: Partial<ProductDraftSku>) {
    const skus = draft.skus.map((sku, currentIndex) => (
      currentIndex === index ? { ...sku, ...patch } : sku
    ));
    onDraftChange({ ...draft, skus });
  }

  return (
    <Dialog id="pl-modal" open={open} titleId="pl-modal-title" onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle id="pl-modal-title">{title}</DialogTitle>
        <form id="pl-form" autoComplete="off" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
          <FormRow>
            <FormField label="账号 *">
              <Select
                name="accountName"
                id="pl-account-select"
                required
                value={draft.accountName}
                onChange={event => updateField('accountName', event.target.value)}
              >
                <option value="">- 请选择 -</option>
                {accounts.map(account => <option value={account} key={account}>{account}</option>)}
              </Select>
            </FormField>
            <FormField label="TK ID *">
              <Input
                name="tkId"
                required
                readOnly={!!editingTkId}
                value={draft.tkId}
                className={invalid.has('tkId') ? 'is-invalid' : ''}
                onChange={event => updateField('tkId', event.target.value)}
              />
            </FormField>
          </FormRow>
          <FormRow className="mt-3">
            <FormField label="商品名称" full>
              <Input name="name" value={draft.name} onChange={event => updateField('name', event.target.value)} />
            </FormField>
          </FormRow>
          <FormRow className="mt-3">
            <FormField label="备注" full>
              <Textarea
                name="note"
                value={draft.note}
                placeholder="可记录选品判断、采购注意事项、售后风险等"
                className="min-h-20 resize-y"
                onChange={event => updateField('note', event.target.value)}
              />
            </FormField>
          </FormRow>
          <FormRow className="mt-3">
            <FormField label="1688 链接">
              <Input type="url" name="link1688" placeholder="https://detail.1688.com/..." value={draft.link1688} onChange={event => updateField('link1688', event.target.value)} />
            </FormField>
            <FormField label="图片 URL">
              <Input type="url" name="imageUrl" placeholder="https://..." value={draft.imageUrl} onChange={event => updateField('imageUrl', event.target.value)} />
            </FormField>
          </FormRow>
          <FormRow className="mt-3">
            <FormField label="货物类型" full>
              <Select name="cargoType" value={draft.cargoType} onChange={event => updateField('cargoType', event.target.value)}>
                <option value="general">普货</option>
                <option value="special">特货</option>
              </Select>
            </FormField>
          </FormRow>

          <div className={productSkuPanelClass}>
            <div className={productSkuHeaderClass}>
              <div>
                <div className={productSkuTitleClass}>SKU规格</div>
                <div className={productSkuCopyClass}>先生成 SKU，再根据实际情况统一设置或按分组调整物流参数。</div>
              </div>
            </div>
            <div className={productSkuActionsClass}>
              <Button size="sm" id="pl-add-sku" onClick={onAddSku}>+ 新增单个SKU</Button>
              <Button size="sm" id="pl-open-sku-batch" aria-expanded={batchOpen ? 'true' : 'false'} onClick={() => onBatchOpenChange(!batchOpen)}>+ 新增多个SKU</Button>
            </div>
            <div className={cn(productSkuBatchToolsClass, batchOpen ? 'block' : 'hidden')} id="pl-sku-batch-tools">
              <div className={productSkuBatchBlockClass}>
                <div className={productSkuBatchTitleClass}>批量生成多个 SKU</div>
                <div className={productSkuBatchCopyClass}>按颜色、尺寸等规格值自动组合生成，已有 SKU 不会重复追加。</div>
                <FormRow columns={3} className={productSkuBatchRowClass}>
                  <FormField label="规格维度 1">
                    <Input id="pl-batch-axis-a" value={draft.axisA} placeholder="例如 白、黑、蓝" onChange={event => updateField('axisA', event.target.value)} />
                  </FormField>
                  <FormField label="规格维度 2">
                    <Input id="pl-batch-axis-b" value={draft.axisB} placeholder="例如 S、M、L" onChange={event => updateField('axisB', event.target.value)} />
                  </FormField>
                  <FormField label="规格维度 3">
                    <Input id="pl-batch-axis-c" value={draft.axisC} placeholder="例如 普通款、升级款" onChange={event => updateField('axisC', event.target.value)} />
                  </FormField>
                </FormRow>
                <div className={productSkuBatchActionsClass}>
                  <Button size="sm" variant="accentSoft" id="pl-generate-skus" onClick={onGenerateSkus}>生成多个 SKU</Button>
                </div>
              </div>
            </div>
            <div className={productSkuParameterPanelClass}>
              <div className={productSkuBatchTitleClass}>参数调整</div>
              <div className={productSkuBatchCopyClass}>留空匹配关键词就应用到全部 SKU；填写关键词则只更新命中的 SKU。</div>
              <div className={productSkuSetupBlockClass}>
                <div className={productSkuSetupSurfaceClass}>
                  <FormRow className={productSkuBatchRowClass}>
                    <FormField label="匹配关键词（可选）" full>
                      <Input
                        id="pl-batch-match"
                        value={draft.matchText}
                        placeholder="例如 S 或 白 / S；留空则应用到全部 SKU"
                        onChange={event => updateField('matchText', event.target.value)}
                      />
                    </FormField>
                  </FormRow>
                  <FormRow className={productSkuBatchRowClass}>
                    <FormField label="重量(g)">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        id="pl-batch-weight"
                        value={draft.defaultWeightG}
                        className={invalid.has('defaultWeightG') ? 'is-invalid' : ''}
                        placeholder="例如 320"
                        onChange={event => updateField('defaultWeightG', event.target.value)}
                      />
                    </FormField>
                    <FormField label="尺寸(cm)">
                      <Input
                        id="pl-batch-size"
                        value={draft.defaultSizeText}
                        className={invalid.has('defaultSizeText') ? 'is-invalid' : ''}
                        placeholder="例如 20×15×10"
                        onChange={event => updateField('defaultSizeText', event.target.value)}
                      />
                    </FormField>
                  </FormRow>
                </div>
              </div>
            </div>
            <SkuEditorList draft={draft} invalid={invalid} onSkuChange={updateSku} onRemoveSku={onRemoveSku} />
          </div>
          <DialogActions>
            <Button id="pl-cancel" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" variant="primary">保存</Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SkuEditorList({
  draft,
  invalid,
  onSkuChange,
  onRemoveSku
}: {
  draft: ProductFormDraft;
  invalid: Set<string>;
  onSkuChange: (index: number, patch: Partial<ProductDraftSku>) => void;
  onRemoveSku: (index: number) => void;
}) {
  const defaultSnapshot = useMemo(() => {
    const dimensions = resolveProductDimensions({ sizeText: draft.defaultSizeText });
    return {
      cargoType: draft.cargoType,
      weightG: draft.defaultWeightG,
      sizeText: draft.defaultSizeText,
      ...dimensions
    };
  }, [draft.cargoType, draft.defaultSizeText, draft.defaultWeightG]);
  const pricingContext = useMemo(() => ensureGlobalSettingsStore().getPricingContext(), []);

  if (!draft.skus.length) {
    return <div className={productSkuListClass} id="pl-sku-list"><div className={productSkuEmptyClass}>请先添加 SKU；每个 SKU 单独维护重量、尺寸和预估运费。</div></div>;
  }

  return (
    <div className={productSkuListClass} id="pl-sku-list">
      <div className={productSkuEditWrapClass}>
        <Table className={productSkuEditTableClass}>
          <TableHeader>
            <TableRow>
              <TableHead className={productSkuEditHeadCellClass}>SKU 名称</TableHead>
              <TableHead className={productSkuEditHeadCellClass}>SKU ID</TableHead>
              <TableHead className={productSkuEditHeadCellClass}>重量(g)</TableHead>
              <TableHead className={productSkuEditHeadCellClass}>尺寸(cm)</TableHead>
              <TableHead className={productSkuEditHeadCellClass}>预估海外运费</TableHead>
              <TableHead className={productSkuEditHeadCellClass}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {draft.skus.map((sku, index) => {
              const isLastSku = index === draft.skus.length - 1;
              const skuCellClass = cn(productSkuEditCellClass, isLastSku ? 'border-b-0' : '');
              const useDefaults = skuUsesProductDefaults(sku);
              const weightG = useDefaults ? String(defaultSnapshot.weightG || '') : String(sku.weightG || '');
              const sizeText = useDefaults ? String(defaultSnapshot.sizeText || '') : String(sku.sizeText || formatSizeInput(sku) || '');
              const dimensions = resolveProductDimensions({ ...sku, sizeText });
              const snapshot = buildEstimatedShippingSnapshot({
                shippingCore: TKShippingCore,
                pricingContext,
                product: {
                  cargoType: draft.cargoType,
                  weightG,
                  sizeText,
                  ...dimensions
                }
              });
              return (
                <TableRow className={cn(productSkuEditRowClass, useDefaults ? 'is-inheriting' : '')} data-sku-index={index} data-sku-use-defaults={useDefaults ? '1' : '0'} key={String(sku.skuId || index)}>
                  <TableCell className={skuCellClass}>
                    <Input
                      density="skuInline"
                      className={invalid.has(`sku.${index}.skuName`) ? 'is-invalid' : ''}
                      data-sku-field="skuName"
                      placeholder="例如 白 / S"
                      value={String(sku.skuName || '')}
                      onChange={event => onSkuChange(index, { skuName: event.target.value })}
                    />
                  </TableCell>
                  <TableCell className={skuCellClass}>
                    <Input
                      density="skuInline"
                      className={invalid.has(`sku.${index}.skuId`) ? 'is-invalid' : ''}
                      data-sku-field="skuId"
                      value={String(sku.skuId || '')}
                      onChange={event => onSkuChange(index, { skuId: event.target.value })}
                    />
                  </TableCell>
                  <TableCell className={skuCellClass}>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      density="skuInline"
                      className={invalid.has(`sku.${index}.weightG`) ? 'is-invalid' : ''}
                      data-sku-field="weightG"
                      value={weightG}
                      onChange={event => onSkuChange(index, { weightG: event.target.value, useProductDefaults: false })}
                    />
                  </TableCell>
                  <TableCell className={skuCellClass}>
                    <Input
                      density="skuInline"
                      className={invalid.has(`sku.${index}.sizeText`) ? 'is-invalid' : ''}
                      data-sku-field="sizeText"
                      placeholder="例如 20×15×10"
                      value={sizeText}
                      onChange={event => onSkuChange(index, { sizeText: event.target.value, useProductDefaults: false })}
                    />
                  </TableCell>
                  <TableCell className={skuCellClass}>
                    <div className={productSkuFeeStackClass}>
                      <span className={productSkuFeeValueClass} data-sku-estimated-fee>{snapshot.estimatedShippingFee ? `¥ ${snapshot.estimatedShippingFee}` : '-'}</span>
                      <span className={productSkuFeeSubClass} data-sku-charge-weight>{snapshot.chargeWeightKg ? `计费重 ${snapshot.chargeWeightKg} kg` : ''}</span>
                      <span className={productSkuFeeNoteClass} data-sku-note>
                        {!useDefaults && sizeText.trim() && !dimensions.isComplete ? '尺寸请按 长×宽×高 填写' : snapshot.shippingNote}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className={cn(skuCellClass, productSkuActionsCellClass)}>
                    <Button size="sm" variant="danger" data-sku-remove={index} onClick={() => onRemoveSku(index)}>删除</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ExportModal({
  open,
  options,
  selected,
  onSelectedChange,
  onOpenChange,
  onConfirm
}: {
  open: boolean;
  options: { key: string; label: string; count: number }[];
  selected: Set<string>;
  onSelectedChange: (selected: Set<string>) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog id="pl-export-modal" open={open} titleId="pl-export-title" onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogTitle id="pl-export-title">选择要导出的账号</DialogTitle>
        <Alert variant="info" className={modalCopyClass}>
          <AlertDescription>可勾选一个或多个账号；如果当前已经切到某个账号，会默认选中该账号。</AlertDescription>
        </Alert>
        <ExportOptions
          allCheckboxId="pl-export-all"
          checkboxClassName="pl-export-checkbox"
          countLabel={count => `${count} 个商品`}
          options={options}
          optionsId="pl-export-options"
          selected={selected}
          onSelectedChange={onSelectedChange}
        />
        <DialogActions>
          <Button id="pl-export-cancel" onClick={() => onOpenChange(false)}>取消</Button>
          <Button id="pl-export-confirm" variant="primary" onClick={onConfirm}>导出 CSV</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

function buildDraftFromProduct(product: ProductRecord | null, activeAccount: string, accounts: string[]): ProductFormDraft {
  if (!product) {
    return {
      ...EMPTY_PRODUCT_FORM,
      accountName: activeAccount && activeAccount !== '__all__' ? activeAccount : accounts[0] || '',
      skus: [createEmptySku()]
    };
  }
  const defaults = ProductLibraryTable.getProductDefaults(product);
  const skus = ProductLibraryTable.getProductSkus(product);
  return {
    accountName: String(product.accountName || ''),
    tkId: String(product.tkId || ''),
    name: String(product.name || ''),
    note: String(product.note || ''),
    link1688: String(product.link1688 || ''),
    imageUrl: String(product.imageUrl || ''),
    cargoType: String(defaults?.cargoType || 'general'),
    matchText: '',
    defaultWeightG: String(defaults?.weightG || ''),
    defaultSizeText: String(defaults?.sizeText || formatSizeInput(defaults) || ''),
    axisA: '',
    axisB: '',
    axisC: '',
    skus: skus.length ? skus.map(sku => ({
      ...sku,
      sizeText: String(sku.sizeText || formatSizeInput(sku) || '')
    })) : [createEmptySku()]
  };
}

function ProductsPage({ active = true }: { active?: boolean }) {
  const providerRef = useRef(ProductLibraryProviderFirestore.create({
    state: {},
    helpers: { nowIso: () => new Date().toISOString() }
  }));
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [copyingRules, setCopyingRules] = useState(false);
  const [syncText, setSyncText] = useState('未连接');
  const [syncClass, setSyncClass] = useState('');
  const [projectId, setProjectId] = useState('');
  const [accounts, setAccounts] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [activeAccount, setActiveAccount] = useState('__all__');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedTkIds, setExpandedTkIds] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [editingTkId, setEditingTkId] = useState('');
  const [draft, setDraft] = useState<ProductFormDraft>({ ...EMPTY_PRODUCT_FORM, skus: [createEmptySku()] });
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [editingAccountName, setEditingAccountName] = useState('');
  const [editingAccountValue, setEditingAccountValue] = useState('');
  const [accountDeleteOpen, setAccountDeleteOpen] = useState(false);
  const [deletingAccountName, setDeletingAccountName] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSelected, setExportSelected] = useState<Set<string>>(new Set());
  const [searchHelpOpen, setSearchHelpOpen] = useState(false);

  const allAccounts = accounts;

  const productExporter = useMemo(() => ProductLibraryExport.create({
    state: {
      accounts: allAccounts,
      activeAccount
    },
    helpers: {
      getDisplayedProducts: (overrides: { activeAccount?: string } = {}) => ProductLibraryTable.deriveDisplayedProducts({
        products,
        activeAccount: overrides.activeAccount || activeAccount,
        searchQuery,
        sortOrder
      }),
      normalizeAccountName,
      toAccountSlot,
      uniqueAccounts
    }
  }), [activeAccount, allAccounts, products, searchQuery, sortOrder]);

  const exportOptions = useMemo(
    () => productExporter.getProductExportAccountOptions(),
    [productExporter]
  );
  const accountTabItems = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(product => {
      const account = normalizeAccountName(product?.accountName);
      if (account) counts[account] = (counts[account] || 0) + 1;
    });
    return allAccounts.map(account => ({
      key: account,
      label: account,
      count: counts[account] || 0,
      dataAttrs: { 'data-pl-acc': account }
    }));
  }, [allAccounts, products]);

  const notifyProductsChanged = useCallback((detail: Record<string, unknown> = {}) => {
    window.dispatchEvent(new CustomEvent('tk-products-changed', {
      detail: {
        source: 'products',
        projectId,
        ...detail
      }
    }));
  }, [projectId]);

  const notifyAccountsChanged = useCallback((detail: Record<string, unknown> = {}) => {
    window.dispatchEvent(new CustomEvent(ACCOUNT_UPDATED_EVENT, {
      detail: {
        source: 'products',
        projectId,
        ...detail
      }
    }));
  }, [projectId]);

  const formatFirestoreError = useCallback((error: unknown, fallback = '商品管理操作失败') => {
    const err = error as { code?: string; message?: string };
    const message = String(err?.message || '').trim();
    if (isPermissionDenied(error)) {
      return formatFirestoreRulesUpdateMessage('products', ['products.read', 'products.write']);
    }
    return message || fallback;
  }, []);

  const loadProducts = useCallback(async () => {
    const result = await providerRef.current.pullProducts();
    setProducts(result.products || []);
    setAccounts(Array.isArray(result.accounts) ? result.accounts : []);
    setLoaded(true);
    setPermissionBlocked(false);
    setSyncText(`已同步 · ${(result.products || []).length} 个商品`);
    setSyncClass('saved');
  }, []);

  const markPermissionBlocked = useCallback(() => {
    setLoaded(true);
    setConnected(true);
    setPermissionBlocked(true);
    setProducts([]);
    setAccounts([]);
    setSyncText('');
    setSyncClass('error');
  }, []);

  const connectUsingGlobalConfig = useCallback(async () => {
    const cfg = readGlobalConfig();
    if (!cfg?.configText) {
      setConnected(false);
      setLoaded(false);
      setPermissionBlocked(false);
      setSyncText('未连接');
      setSyncClass('');
      return false;
    }
    setLoading(true);
    setSyncText('正在刷新云端数据…');
    setSyncClass('saving');
    try {
      const next = await providerRef.current.init({ firestoreConfigText: cfg.configText });
      setProjectId(next.projectId);
      setConnected(true);
      await loadProducts();
      return true;
    } catch (error) {
      if (isPermissionDenied(error)) {
        markPermissionBlocked();
        return false;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadProducts, markPermissionBlocked]);

  useEffect(() => {
    void connectUsingGlobalConfig().catch(error => {
      showToast(formatFirestoreError(error, '连接商品管理失败'), 'error');
      setConnected(false);
      setSyncText('未连接');
      setSyncClass('');
    });
  }, [connectUsingGlobalConfig, formatFirestoreError]);

  useEffect(() => {
    const handleConnectionChange = (event: Event) => {
      const custom = event as CustomEvent<{ connected?: boolean }>;
      const nextConnected = custom.detail?.connected !== false && !!readGlobalConfig()?.configText;
      setLoaded(false);
      setProjectId('');
      setAccounts([]);
      setProducts([]);
      setActiveAccount('__all__');
      setSearchQuery('');
      setPageSize(50);
      setCurrentPage(1);
      setEditingTkId('');
      setPermissionBlocked(false);
      if (!nextConnected) {
        setConnected(false);
        setSyncText('未连接');
        setSyncClass('');
        return;
      }
      void connectUsingGlobalConfig().catch(error => {
        showToast(formatFirestoreError(error, '连接商品管理失败'), 'error');
        setConnected(false);
        setSyncText('未连接');
        setSyncClass('');
      });
    };
    const handleAccountsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string; accounts?: string[] }>).detail || {};
      if (detail.source === 'products' || !readGlobalConfig()?.configText) return;
      if (Array.isArray(detail.accounts)) {
        const nextAccounts = uniqueAccounts(detail.accounts);
        setAccounts(nextAccounts);
        setActiveAccount(current => current === '__all__' || nextAccounts.includes(current) ? current : '__all__');
        setCurrentPage(1);
      }
      void loadProducts().catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
      });
    };
    window.addEventListener('tk-firestore-config-changed', handleConnectionChange);
    window.addEventListener(ACCOUNT_UPDATED_EVENT, handleAccountsChanged);
    return () => {
      window.removeEventListener('tk-firestore-config-changed', handleConnectionChange);
      window.removeEventListener(ACCOUNT_UPDATED_EVENT, handleAccountsChanged);
    };
  }, [connectUsingGlobalConfig, formatFirestoreError, loadProducts, markPermissionBlocked]);

  useEffect(() => {
    if (activeAccount === '__all__' || allAccounts.includes(activeAccount)) return;
    setActiveAccount('__all__');
  }, [activeAccount, allAccounts]);

  useEffect(() => {
    if (!active || !connected || !readGlobalConfig()?.configText) return;
    void loadProducts().catch(error => {
      if (isPermissionDenied(error)) markPermissionBlocked();
    });
  }, [active, connected, loadProducts, markPermissionBlocked]);

  function openProductModal(tkId = '') {
    const product = tkId ? products.find(item => item.tkId === tkId) || null : null;
    setEditingTkId(tkId);
    setDraft(buildDraftFromProduct(product, activeAccount, allAccounts));
    setInvalid(new Set());
    setBatchOpen(false);
    setModalOpen(true);
  }

  async function copyLink(link: string) {
    const text = String(link || '').trim();
    if (!text) {
      showToast('没有可复制的链接', 'error');
      return;
    }
    try {
      await TKFirestoreConnection.copyText(text);
      showToast('链接已复制');
    } catch (error) {
      showToast((error as Error)?.message || '复制失败', 'error');
    }
  }

  async function copyFirestoreRules() {
    setCopyingRules(true);
    try {
      await TKFirestoreConnection.copyRules();
      showToast('Firestore 规则已复制');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '规则复制失败', 'error');
    } finally {
      setCopyingRules(false);
    }
  }

  function applyDraftChange(next: ProductFormDraft) {
    const matchText = String(next.matchText || '').trim().toLowerCase();
    const weightChanged = next.defaultWeightG !== draft.defaultWeightG;
    const sizeChanged = next.defaultSizeText !== draft.defaultSizeText;
    if ((weightChanged || sizeChanged) && (next.defaultWeightG || next.defaultSizeText)) {
      next = {
        ...next,
        skus: next.skus.map(sku => {
          if (matchText && !matchesBatchSkuName(sku.skuName, matchText)) return sku;
          return {
            ...sku,
            useProductDefaults: matchText ? false : true,
            weightG: matchText && weightChanged ? next.defaultWeightG : sku.weightG,
            sizeText: matchText && sizeChanged ? next.defaultSizeText : sku.sizeText
          };
        })
      };
    }
    setInvalid(new Set());
    setDraft(next);
  }

  function appendGeneratedSkus() {
    const generated = buildBatchSkuDrafts(draft.axisA, draft.axisB, draft.axisC);
    if (!generated.length) {
      showToast('请先填写至少一组规格值', 'error');
      return;
    }
    const existingNames = new Set(draft.skus.map(item => String(item.skuName || '').trim()).filter(Boolean));
    const appended = generated
      .filter(item => !existingNames.has(item.skuName))
      .map(item => ({ ...createEmptySku(), skuName: item.skuName }));
    if (!appended.length) {
      showToast('这些 SKU 名称已经都存在了', 'error');
      return;
    }
    setDraft({
      ...draft,
      axisA: '',
      axisB: '',
      axisC: '',
      skus: [...draft.skus, ...appended]
    });
    showToast(`已生成 ${appended.length} 个 SKU`);
  }

  function buildProductDefaultsSnapshot() {
    const dimensions = resolveProductDimensions({ sizeText: draft.defaultSizeText });
    return {
      cargoType: draft.cargoType,
      weightG: draft.defaultWeightG,
      sizeText: draft.defaultSizeText,
      ...dimensions,
      ...buildEstimatedShippingSnapshot({
        shippingCore: TKShippingCore,
        pricingContext: ensureGlobalSettingsStore().getPricingContext(),
        product: {
          cargoType: draft.cargoType,
          weightG: draft.defaultWeightG,
          sizeText: draft.defaultSizeText,
          ...dimensions
        }
      })
    };
  }

  function normalizeSkuDrafts() {
    const defaultSnapshot = buildProductDefaultsSnapshot();
    const seen = new Set<string>();
    const nextInvalid = new Set<string>();
    const normalized: ProductSku[] = [];
    for (const [index, sku] of draft.skus.entries()) {
      const skuName = String(sku.skuName || '').trim();
      const useDefaults = skuUsesProductDefaults(sku);
      const weightG = String(sku.weightG || '').trim();
      const sizeText = String(sku.sizeText || '').trim();
      const hasAnyValue = !!(skuName || weightG || sizeText);
      if (!hasAnyValue) continue;
      if (!skuName) {
        nextInvalid.add(`sku.${index}.skuName`);
        return { error: '请输入 SKU 名称', skus: [], invalid: nextInvalid };
      }
      const skuId = String(sku.skuId || '').trim() || generateInternalSkuId();
      if (seen.has(skuId)) {
        nextInvalid.add(`sku.${index}.skuId`);
        return { error: 'SKU 内部标识重复了，请重新打开弹窗后再试', skus: [], invalid: nextInvalid };
      }
      seen.add(skuId);
      if (useDefaults && (!String(defaultSnapshot.weightG || '').trim() || !defaultSnapshot.isComplete)) {
        nextInvalid.add('defaultWeightG');
        nextInvalid.add('defaultSizeText');
        return { error: `SKU「${skuName}」缺少共用重量或尺寸，无法保存`, skus: [], invalid: nextInvalid };
      }
      if (!useDefaults) {
        const invalidFields: string[] = [];
        if (!weightG) invalidFields.push('weightG');
        if (!sizeText) invalidFields.push('sizeText');
        if (invalidFields.length) {
          invalidFields.forEach(field => nextInvalid.add(`sku.${index}.${field}`));
          return { error: `请补全 SKU「${skuName}」的重量和尺寸`, skus: [], invalid: nextInvalid };
        }
      }
      const dimensions = resolveProductDimensions({ ...sku, sizeText: useDefaults ? defaultSnapshot.sizeText : sizeText });
      const snapshot = buildEstimatedShippingSnapshot({
        shippingCore: TKShippingCore,
        pricingContext: ensureGlobalSettingsStore().getPricingContext(),
        product: {
          cargoType: draft.cargoType,
          weightG: useDefaults ? defaultSnapshot.weightG : weightG,
          sizeText: useDefaults ? defaultSnapshot.sizeText : sizeText,
          ...dimensions
        }
      });
      if (!useDefaults && sizeText && !dimensions.isComplete) {
        nextInvalid.add(`sku.${index}.sizeText`);
        return { error: `SKU「${skuName}」尺寸请按 长×宽×高 填写`, skus: [], invalid: nextInvalid };
      }
      normalized.push({
        skuId,
        skuName,
        useProductDefaults: useDefaults,
        weightG: useDefaults ? '' : String(weightG),
        sizeText: useDefaults ? '' : String(dimensions.sizeText || sizeText),
        lengthCm: useDefaults ? '' : dimensions.lengthCm,
        widthCm: useDefaults ? '' : dimensions.widthCm,
        heightCm: useDefaults ? '' : dimensions.heightCm,
        estimatedShippingFee: useDefaults ? '' : snapshot.estimatedShippingFee,
        chargeWeightKg: useDefaults ? '' : snapshot.chargeWeightKg,
        shippingNote: useDefaults ? '' : snapshot.shippingNote
      });
    }
    return { skus: normalized, error: '', invalid: nextInvalid };
  }

  async function submitProduct() {
    const payload = {
      accountName: draft.accountName.trim(),
      tkId: draft.tkId.trim(),
      name: draft.name.trim(),
      note: draft.note.trim(),
      link1688: draft.link1688.trim(),
      imageUrl: draft.imageUrl.trim()
    };
    const nextInvalid = new Set<string>();
    if (!payload.tkId) nextInvalid.add('tkId');
    if (!payload.accountName) nextInvalid.add('accountName');
    const duplicate = products.find(item => item.tkId === payload.tkId && item.tkId !== editingTkId);
    if (duplicate) nextInvalid.add('tkId');
    const { skus, error, invalid: skuInvalid } = normalizeSkuDrafts();
    skuInvalid.forEach(item => nextInvalid.add(item));
    if (nextInvalid.size) {
      setInvalid(nextInvalid);
      showToast(error || (duplicate ? '该 TK ID 已存在' : '请补全商品必填项'), 'error');
      return;
    }
    if (!skus.length) {
      showToast('请至少添加一个 SKU', 'error');
      return;
    }
    const current = editingTkId ? products.find(item => item.tkId === editingTkId) : null;
    const defaultSnapshot = buildProductDefaultsSnapshot();
    try {
      const result = await providerRef.current.upsertProduct({
        ...current,
        ...payload,
        defaults: {
          cargoType: defaultSnapshot.cargoType,
          weightG: defaultSnapshot.weightG,
          sizeText: defaultSnapshot.sizeText,
          lengthCm: defaultSnapshot.lengthCm,
          widthCm: defaultSnapshot.widthCm,
          heightCm: defaultSnapshot.heightCm,
          estimatedShippingFee: defaultSnapshot.estimatedShippingFee,
          chargeWeightKg: defaultSnapshot.chargeWeightKg,
          shippingNote: defaultSnapshot.shippingNote
        },
        skus,
        createdAt: current?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { waitForCommit: false });
      const saved = isProductDeferredWrite(result) ? result.product : result;
      if (!saved) throw new Error('商品保存结果为空');
      setProducts(previous => [...previous.filter(item => item.tkId !== saved.tkId), saved]);
      notifyProductsChanged({ action: 'upsert', tkId: saved?.tkId || payload.tkId });
      if (isProductDeferredWrite(result)) result.commitPromise.then(() => {
        notifyProductsChanged({ action: 'commit', tkId: saved?.tkId || payload.tkId });
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        showToast(formatFirestoreError(error, '商品保存失败'), 'error');
      });
      setModalOpen(false);
      setEditingTkId('');
      setPermissionBlocked(false);
      showToast('商品已保存');
    } catch (error) {
      if (isPermissionDenied(error)) markPermissionBlocked();
      showToast(formatFirestoreError(error, '商品保存失败'), 'error');
    }
  }

  async function deleteProduct(tkId: string) {
    if (!window.confirm('确定删除这个商品？')) return;
    try {
      const result = await providerRef.current.deleteProduct(tkId, { waitForCommit: false });
      setProducts(previous => previous.filter(item => item.tkId !== tkId));
      notifyProductsChanged({ action: 'delete', tkId });
      if (typeof result === 'object' && result?.commitPromise) result.commitPromise.then(() => {
        notifyProductsChanged({ action: 'commit', tkId });
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        showToast(formatFirestoreError(error, '商品删除失败'), 'error');
      });
      setPermissionBlocked(false);
      showToast('商品已删除');
    } catch (error) {
      if (isPermissionDenied(error)) markPermissionBlocked();
      showToast(formatFirestoreError(error, '商品删除失败'), 'error');
    }
  }

  async function addAccount() {
    const name = newAccountName.trim();
    if (!name) return;
    if (allAccounts.includes(name)) {
      showToast('该账号已存在', 'error');
      return;
    }
    try {
      const nextAccounts = uniqueAccounts([...allAccounts, name]);
      const result = await providerRef.current.upsertAccount(name, { sortIndex: nextAccounts.indexOf(name), waitForCommit: false });
      setAccounts(nextAccounts);
      setActiveAccount(name);
      setCurrentPage(1);
      setDraft(previous => ({ ...previous, accountName: name }));
      setNewAccountName('');
      setAccountModalOpen(false);
      setPermissionBlocked(false);
      setSyncText('账号已保存到 Firestore 本地队列…');
      setSyncClass('saving');
      notifyAccountsChanged({ action: 'upsert', account: name, accounts: nextAccounts });
      if (typeof result === 'object' && result?.commitPromise) result.commitPromise.then(() => {
        setSyncText(`已同步 · ${products.length} 个商品`);
        setSyncClass('saved');
        notifyAccountsChanged({ action: 'commit', account: name, accounts: nextAccounts });
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        showToast(formatFirestoreError(error, '账号保存失败'), 'error');
      });
      showToast('账号已添加');
    } catch (error) {
      if (isPermissionDenied(error)) markPermissionBlocked();
      showToast(formatFirestoreError(error, '账号保存失败'), 'error');
    }
  }

  async function reorderAccounts(nextOrder: string[]) {
    const nextAccounts = uniqueAccounts(nextOrder);
    if (!nextAccounts.length) return;
    setAccounts(nextAccounts);
    notifyAccountsChanged({ action: 'reorder', accounts: nextAccounts });
    try {
      const result = await providerRef.current.saveAccountOrder(nextAccounts, { waitForCommit: false });
      if (typeof result === 'object' && result?.commitPromise) result.commitPromise.catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        showToast(formatFirestoreError(error, '账号排序保存失败'), 'error');
      });
    } catch (error) {
      if (isPermissionDenied(error)) markPermissionBlocked();
      showToast(formatFirestoreError(error, '账号排序保存失败'), 'error');
    }
  }

  function openEditAccount(account: string) {
    setEditingAccountName(account);
    setEditingAccountValue(account);
    setAccountEditOpen(true);
  }

  function openDeleteAccount(account: string) {
    setDeletingAccountName(account);
    setAccountDeleteOpen(true);
  }

  async function renameAccount() {
    const oldName = editingAccountName.trim();
    const newName = editingAccountValue.trim();
    if (!oldName || !newName) return;
    if (oldName === newName) {
      setAccountEditOpen(false);
      return;
    }
    if (allAccounts.some(account => account !== oldName && account === newName)) {
      showToast('该账号已存在', 'error');
      return;
    }
    const nextAccounts = allAccounts.map(account => account === oldName ? newName : account);
    const nextProducts = products.map(product => (
      normalizeAccountName(product.accountName) === oldName ? { ...product, accountName: newName } : product
    ));
    setAccounts(nextAccounts);
    setProducts(nextProducts);
    if (activeAccount === oldName) setActiveAccount(newName);
    setCurrentPage(1);
    setAccountEditOpen(false);
    setEditingAccountName('');
    setEditingAccountValue('');
    setSyncText('账号名已保存到 Firestore 本地队列…');
    setSyncClass('saving');
    notifyAccountsChanged({ action: 'rename', oldAccount: oldName, account: newName, accounts: nextAccounts });
    notifyProductsChanged({ action: 'rename-account', oldAccount: oldName, account: newName });
    try {
      const result = await providerRef.current.renameAccount(oldName, newName, { accountOrder: allAccounts, waitForCommit: false });
      if (result?.commitPromise) result.commitPromise.then(() => {
        setSyncText(`已同步 · ${nextProducts.length} 个商品`);
        setSyncClass('saved');
        notifyAccountsChanged({ action: 'commit', account: newName, accounts: nextAccounts });
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        showToast(formatFirestoreError(error, '账号名保存失败'), 'error');
      });
      showToast('账号名已更新');
    } catch (error) {
      if (isPermissionDenied(error)) markPermissionBlocked();
      showToast(formatFirestoreError(error, '账号名保存失败'), 'error');
    }
  }

  async function deleteAccount() {
    const name = deletingAccountName.trim();
    if (!name) return;
    const nextAccounts = allAccounts.filter(account => account !== name);
    setAccounts(nextAccounts);
    setActiveAccount(current => current === name ? '__all__' : current);
    setCurrentPage(1);
    setAccountDeleteOpen(false);
    setDeletingAccountName('');
    setSyncText('账号名已删除，数据保留在全部…');
    setSyncClass('saving');
    notifyAccountsChanged({ action: 'delete', account: name, accounts: nextAccounts });
    try {
      const result = await providerRef.current.deleteAccount(name, { accountOrder: allAccounts, waitForCommit: false });
      if (result?.commitPromise) result.commitPromise.then(() => {
        setSyncText(`已同步 · ${products.length} 个商品`);
        setSyncClass('saved');
        notifyAccountsChanged({ action: 'commit-delete', account: name, accounts: nextAccounts });
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        showToast(formatFirestoreError(error, '账号名删除失败'), 'error');
      });
      showToast('账号名已删除，数据仍在全部里');
    } catch (error) {
      if (isPermissionDenied(error)) markPermissionBlocked();
      showToast(formatFirestoreError(error, '账号名删除失败'), 'error');
    }
  }

  function openExportModal() {
    if (!exportOptions.length) {
      showToast('当前没有可导出的商品数据', 'error');
      return;
    }
    const defaultSelected = activeAccount && activeAccount !== '__all__'
      ? new Set([activeAccount])
      : new Set<string>(exportOptions.map(option => String(option.key)));
    setExportSelected(defaultSelected);
    setExportOpen(true);
  }

  function confirmExport() {
    if (!exportSelected.size) {
      showToast('请至少选择一个账号', 'error');
      return;
    }
    const rows = productExporter.buildProductExportRows(exportSelected);
    if (!rows.length) {
      showToast('当前选择下没有可导出的商品数据', 'error');
      return;
    }
    const headers = ['账号', 'TK ID', '商品名称', '货物类型', 'SKU 名称', 'SKU ID', '重量(g)', '尺寸(cm)', '单件预估海外运费(元)', '1688 链接', '图片 URL', '创建时间', '更新时间', '备注'];
    const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
    const selectedOptions = exportOptions.filter(option => exportSelected.has(option.key));
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = productExporter.buildProductExportFilename(selectedOptions);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportOpen(false);
    showToast('CSV 已开始导出');
  }

  return (
    <section className="products-page" data-react-products-page-ready="true">
      <PageHero
        variant="products"
        title="商品管理"
        kicker="商品资料 / 预估运费 / 采购链接"
        description="沉淀商品资料、预估运费和采购链接，录一次基础资料，后续订单直接复用。"
      />

      <Card id="pl-main">
        <div className={cn('ot-header-status-row mb-3', statusStripClass)}>
          <div className={cn(statusStripLeftClass, 'min-w-0 flex-wrap')}>
            <Badge className="min-h-[30px] min-w-0 max-w-full truncate text-[var(--text)] font-semibold" id="pl-user">
              {connected ? (projectId ? `已连接 · ${projectId} · Firestore` : '已连接 · Firebase Firestore') : '未连接 Firebase'}
            </Badge>
            {permissionBlocked ? null : <Badge id="pl-sync" className={syncStatusClass(syncClass)}>{syncText}</Badge>}
            <Button
              id="pl-refresh"
              variant="plain"
              className={refreshButtonClass(loading)}
              disabled={loading}
              aria-label="刷新商品数据"
              title="刷新商品数据"
              aria-busy={loading ? 'true' : 'false'}
              onClick={() => void loadProducts().catch(error => {
                if (isPermissionDenied(error)) {
                  markPermissionBlocked();
                  showToast(formatFirestoreError(error, '刷新失败'), 'error');
                  return;
                }
                showToast(formatFirestoreError(error, '刷新失败'), 'error');
                setSyncText('刷新失败');
                setSyncClass('error');
              })}
            >
              <RefreshCw size={15} strokeWidth={2} aria-hidden="true" className={loading ? 'is-spinning' : ''} />
            </Button>
          </div>
          <div className={statusStripRightClass}>
            {connected ? (
              <>
                <Button id="pl-export" size="sm" className="inline-flex items-center justify-center gap-1.5" onClick={openExportModal}><FileDown size={14} strokeWidth={2} aria-hidden="true" />导出 CSV</Button>
                <Button id="pl-disconnect-firestore" size="sm" variant="danger" data-firestore-disconnect onClick={() => TKFirestoreConnection.requestDisconnect()}>退出数据库</Button>
              </>
            ) : null}
          </div>
        </div>

        {!connected ? (
          <ModuleListState
            tone="connect"
            title="连接数据库"
            description="先连接你的 Firebase Firestore。商品和订单共用同一个 Firebase 项目，本站不保存你的商品资料。"
            actions={[{ id: 'pl-open-connection', label: '连接 Firebase', variant: 'primary', onClick: () => TKFirestoreConnection.open() }]}
          />
        ) : permissionBlocked ? (
          <ModuleListState
            tone="permission"
            title="数据库权限不足"
            description="当前数据库权限不足，商品管理保存不可用。复制最新 Firestore 规则发布后刷新页面。"
            actions={[
              { label: '打开 Firebase Console', onClick: () => TKFirestoreConnection.openConsole() },
              { label: copyingRules ? '复制中…' : '复制 Firestore 规则', variant: 'primary', disabled: copyingRules, onClick: () => void copyFirestoreRules() }
            ]}
          />
        ) : (
          <>
            <AccountTabsBar
              id="pl-acc-tabs"
              className="pl-account-tabs-row mb-3"
              activeKey={activeAccount}
              allCount={products.length}
              allDataAttrs={{ 'data-pl-acc': '__all__' }}
              allTabsId="pl-acc-tabs-all"
              scrollId="pl-acc-tabs-scroll"
              actionsId="pl-acc-actions"
              items={accountTabItems}
              emptyText="暂无账号，点击 + 添加账号"
              addAccountButton={{ id: 'pl-tab-add', title: '添加账号', onClick: () => setAccountModalOpen(true) }}
              onEditAccount={openEditAccount}
              onDeleteAccount={openDeleteAccount}
              onReorder={reorderAccounts}
              onChange={account => { setActiveAccount(account); setCurrentPage(1); }}
              actions={<Button id="pl-add" variant="primary" onClick={() => openProductModal()}><Plus size={14} strokeWidth={2} aria-hidden="true" />新增商品</Button>}
            />

            <ProductsTableView
              products={products}
              activeAccount={activeAccount}
              searchQuery={searchQuery}
              searchHelpOpen={searchHelpOpen}
              sortOrder={sortOrder}
              pageSize={pageSize}
              currentPage={currentPage}
              expandedTkIds={expandedTkIds}
              onSearchChange={value => { setSearchQuery(value); setCurrentPage(1); }}
              onSearchHelpOpenChange={setSearchHelpOpen}
              onPageSizeChange={value => { setPageSize(Math.max(1, Number(value) || 50)); setCurrentPage(1); }}
              onPageChange={delta => setCurrentPage(page => Math.max(1, page + delta))}
              onSortToggle={() => { setSortOrder(value => value === 'asc' ? 'desc' : 'asc'); setCurrentPage(1); }}
              onToggleExpand={tkId => setExpandedTkIds(previous => ({ ...previous, [tkId]: !previous[tkId] }))}
              onCopyLink={copyLink}
              onEdit={openProductModal}
              onDelete={deleteProduct}
            />
          </>
        )}
      </Card>

      <ProductModal
        open={modalOpen}
        draft={draft}
        accounts={allAccounts}
        editingTkId={editingTkId}
        invalid={invalid}
        batchOpen={batchOpen}
        onOpenChange={open => { setModalOpen(open); if (!open) setEditingTkId(''); }}
        onDraftChange={applyDraftChange}
        onBatchOpenChange={setBatchOpen}
        onGenerateSkus={appendGeneratedSkus}
        onAddSku={() => setDraft(previous => ({ ...previous, skus: [...previous.skus, createEmptySku()] }))}
        onRemoveSku={index => setDraft(previous => ({ ...previous, skus: previous.skus.filter((_, currentIndex) => currentIndex !== index) }))}
        onSubmit={submitProduct}
      />

      <AddAccountDialog
        modalId="pl-add-acc-modal"
        formId="pl-add-acc-form"
        inputId="pl-new-acc-input"
        open={accountModalOpen}
        value={newAccountName}
        onValueChange={setNewAccountName}
        onOpenChange={setAccountModalOpen}
        onConfirm={addAccount}
      />

      <AccountEditDialog
        modalId="pl-edit-acc-modal"
        formId="pl-edit-acc-form"
        inputId="pl-edit-acc-input"
        open={accountEditOpen}
        accountName={editingAccountName}
        value={editingAccountValue}
        onValueChange={setEditingAccountValue}
        onOpenChange={setAccountEditOpen}
        onConfirm={renameAccount}
      />

      <AccountDeleteDialog
        modalId="pl-delete-acc-modal"
        open={accountDeleteOpen}
        accountName={deletingAccountName}
        onOpenChange={setAccountDeleteOpen}
        onConfirm={deleteAccount}
      />

      <ExportModal
        open={exportOpen}
        options={exportOptions}
        selected={exportSelected}
        onSelectedChange={setExportSelected}
        onOpenChange={setExportOpen}
        onConfirm={confirmExport}
      />
    </section>
  );
}

export { ProductsPage };
