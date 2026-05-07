import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProductLibraryProviderFirestore } from '../../../products/provider-firestore.mjs';
import { ProductLibraryExport, csvEscape } from '../../../products/export.mjs';
import {
  buildBatchSkuDrafts,
  buildEstimatedShippingSnapshot,
  formatSizeInput,
  matchesBatchSkuName,
  resolveProductDimensions,
  skuUsesProductDefaults
} from '../../../products/form-utils.mjs';
import { ProductLibraryTable } from '../../../products/table.mjs';
import { ensureGlobalSettingsStore } from '../../../global-settings.mjs';
import { TKShippingCore } from '../../../shipping-core.mjs';
import {
  Copy,
  ExternalLink,
  FileDown,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ProductRecord, ProductSku } from './types';

type ProductDraftSku = ProductSku & {
  sizeText?: string;
};

type ProductFormDraft = {
  accountName: string;
  tkId: string;
  name: string;
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

type ToastType = 'ok' | 'error';

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];
const UNASSIGNED_ACCOUNT_SLOT = '__unassigned__';
const EMPTY_PRODUCT_FORM: ProductFormDraft = {
  accountName: '',
  tkId: '',
  name: '',
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

function normalizeAccountName(value: unknown) {
  return String(value || '').trim();
}

function toAccountSlot(value: unknown) {
  return normalizeAccountName(value) || UNASSIGNED_ACCOUNT_SLOT;
}

function uniqueAccounts(values: unknown[] = []) {
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

function clampPage(currentPage: number, pageSize: number, totalItems: number) {
  const safePageSize = Math.max(1, Number(pageSize) || 50);
  const totalPages = Math.max(1, Math.ceil((totalItems || 0) / safePageSize));
  const nextCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
  return { currentPage: nextCurrentPage, totalPages, pageSize: safePageSize };
}

function readGlobalConfig() {
  return globalThis.window?.TKFirestoreConnection?.getConfig?.() || null;
}

function showToast(message: string, type: ToastType = 'ok') {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2500);
}

showToast.timer = 0;

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
    <div className={cn('ot-table-pagination products-react-pager inline-flex items-center gap-2 flex-wrap', compact ? 'is-compact' : '')}>
      <label className="ot-page-size">
        <span>每页</span>
        <span className="ot-page-size-control">
          <select value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}>
            {PAGE_SIZE_OPTIONS.map(size => <option value={size} key={size}>{size}</option>)}
          </select>
        </span>
      </label>
      <Button size="sm" disabled={currentPage <= 1} onClick={() => onPageChange(-1)}>上一页</Button>
      <span className="ot-page-indicator">{currentPage} / {totalPages}</span>
      <Button size="sm" disabled={currentPage >= totalPages} onClick={() => onPageChange(1)}>下一页</Button>
    </div>
  );
}

function AccountTabs({
  activeAccount,
  accounts,
  products,
  onChange
}: {
  activeAccount: string;
  accounts: string[];
  products: ProductRecord[];
  onChange: (value: string) => void;
}) {
  const countMap = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(product => {
      const account = normalizeAccountName(product?.accountName);
      if (account) counts[account] = (counts[account] || 0) + 1;
    });
    return counts;
  }, [products]);

  return (
    <div className="ot-acc-tabs-scroll-inner">
      {accounts.length ? accounts.map(account => (
        <button
          type="button"
          className={cn('tab', account === activeAccount ? 'active' : '')}
          data-pl-acc={account}
          key={account}
          onClick={() => onChange(account)}
        >
          {account}<span className="tab-count">({countMap[account] || 0})</span>
        </button>
      )) : <span className="ot-acc-empty">暂无账号，先去订单管理添加账号或在已有商品里关联账号</span>}
    </div>
  );
}

function ProductsTableView({
  products,
  activeAccount,
  searchQuery,
  sortOrder,
  pageSize,
  currentPage,
  expandedTkIds,
  onSearchChange,
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
  sortOrder: string;
  pageSize: number;
  currentPage: number;
  expandedTkIds: Record<string, boolean>;
  onSearchChange: (value: string) => void;
  onPageSizeChange: (value: number) => void;
  onPageChange: (delta: number) => void;
  onSortToggle: () => void;
  onToggleExpand: (tkId: string) => void;
  onCopyLink: (link: string) => void;
  onEdit: (tkId: string) => void;
  onDelete: (tkId: string) => void;
}) {
  const [composing, setComposing] = useState(false);
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
      <div id="pl-toolbar" className="ot-table-toolbar ot-sticky-controls pl-sticky-controls products-react-toolbar">
        <div className="ot-sticky-controls-inner products-react-toolbar-inner gap-3 max-[640px]:gap-2.5 max-[900px]:items-start">
          <div className="ot-table-toolbar-left">
            <label className="ot-table-search products-react-search w-full max-w-[520px]">
              <span className="ot-table-search-icon" aria-hidden="true"><Search size={15} strokeWidth={2} /></span>
              <input
                id="pl-table-search-input"
                type="text"
                placeholder=" "
                value={searchQuery}
                autoComplete="off"
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={event => {
                  setComposing(false);
                  onSearchChange(event.currentTarget.value);
                }}
                onChange={event => {
                  if (!composing) onSearchChange(event.currentTarget.value);
                }}
              />
              <span className="ot-table-search-hint">搜索 TK ID / 名称 / 1688 链接</span>
            </label>
          </div>
          <div className="ot-table-toolbar-right">
            <ProductPager
              pageSize={pageState.pageSize}
              currentPage={pageState.currentPage}
              totalPages={pageState.totalPages}
              onPageSizeChange={onPageSizeChange}
              onPageChange={onPageChange}
            />
          </div>
        </div>
      </div>

      <div className="ot-table-wrap products-react-table-wrap products-react-table-shell">
        <div id="pl-table-container" data-react-products-table-ready="true">
          {!displayed.length ? (
            <div className="ot-empty products-react-empty min-h-[180px]">
              <div className="mb-1.5 text-[15px]">
                {searchQuery.trim()
                  ? '没有匹配的商品'
                  : activeAccount !== '__all__'
                    ? `账号「${activeAccount}」下还没有商品`
                    : '还没有商品资料'}
              </div>
              <span className="text-[12.5px] text-[var(--muted)]">
                {searchQuery.trim() ? '试试更换关键词' : '点击右上角「+ 新增商品」开始记录'}
              </span>
            </div>
          ) : (
            <div className="ot-table-inner products-react-table-inner rounded-none border-0 bg-transparent">
              <Table className={cn('pl-table products-react-table table-auto', showAccount ? 'is-all-accounts' : 'is-account-scoped')}>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button id="pl-sort-btn" variant="plain" className="products-react-sort" title={sortTitle} onClick={onSortToggle}>
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
                  <TableHead className="products-react-actions-head">操作</TableHead>
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
                      className={cn('pl-product-row products-react-row', isExpandable ? 'is-expandable' : '', isExpanded ? 'is-expanded' : '')}
                      data-toggle-expand={isExpandable ? tkId : undefined}
                      onClick={event => {
                        if (!isExpandable) return;
                        if ((event.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
                        onToggleExpand(tkId);
                      }}
                    >
                      <TableCell className="mono">
                        <div className="pl-row-seq">
                          <span>{seqNum}</span>
                          {isExpandable ? <span className="pl-expand-caret" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="pl-image-cell">
                        {product.imageUrl
                          ? <img src={String(product.imageUrl)} alt={String(product.name || product.tkId || '商品图片')} className="pl-image products-react-image" />
                          : <span className="pl-image-placeholder products-react-image-placeholder">-</span>}
                      </TableCell>
                      {showAccount ? <TableCell><span className="chip muted products-react-account-chip">{ProductLibraryTable.formatText(product.accountName)}</span></TableCell> : null}
                      <TableCell className="mono products-react-id">{ProductLibraryTable.formatText(product.tkId)}</TableCell>
                      <TableCell className="products-react-name-cell"><div>{ProductLibraryTable.formatText(product.name)}</div></TableCell>
                      <TableCell>{ProductLibraryTable.getCargoTypeLabel(defaults?.cargoType)}</TableCell>
                      <TableCell className="products-react-actions-cell">
                        <span className={cn('pl-sku-count-pill', isExpandable ? 'is-expandable' : '')} title={isExpandable ? '点击展开 SKU 明细' : undefined}>
                          {ProductLibraryTable.formatSkuCount(product)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {link1688 ? (
                          <div className="pl-link-actions products-react-link-actions">
                            <Button asChild size="smIcon" title="打开 1688 链接" aria-label="打开 1688 链接">
                              <a href={link1688} target="_blank" rel="noreferrer"><ExternalLink size={14} strokeWidth={2} /></a>
                            </Button>
                            <Button size="smIcon" data-copy-link={link1688} title="复制 1688 链接" aria-label="复制 1688 链接" onClick={() => onCopyLink(link1688)}>
                              <Copy size={14} strokeWidth={2} />
                            </Button>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="products-react-actions">
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
                        <TableCell colSpan={columnCount}>
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
                                    const merged = ProductLibraryTable.mergeProductSku(product, sku);
                                    return (
                                      <TableRow key={String(sku.skuId || sku.skuName)}>
                                        <TableCell><div className="pl-sku-expanded-sku-main">{ProductLibraryTable.formatSkuLabel(sku)}</div></TableCell>
                                        <TableCell>{ProductLibraryTable.formatWeight(merged?.weightG)}</TableCell>
                                        <TableCell>{ProductLibraryTable.formatSize(merged)}</TableCell>
                                        <TableCell>{ProductLibraryTable.formatSkuShippingFee(product, sku)}</TableCell>
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
            </div>
          )}
        </div>
      </div>

      <div id="pl-table-footer-toolbar-container">
        <div className="ot-table-toolbar ot-table-toolbar-bottom products-react-footer-toolbar mt-3">
          <div className="ot-sticky-controls-inner">
            <div />
            <div className="ot-table-toolbar-right">
              <ProductPager
                compact
                pageSize={pageState.pageSize}
                currentPage={pageState.currentPage}
                totalPages={pageState.totalPages}
                onPageSizeChange={onPageSizeChange}
                onPageChange={onPageChange}
              />
            </div>
          </div>
        </div>
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
          <div className="row">
            <div className="field">
              <label>账号 *</label>
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
            </div>
            <div className="field">
              <label>TK ID *</label>
              <Input
                name="tkId"
                required
                readOnly={!!editingTkId}
                value={draft.tkId}
                className={invalid.has('tkId') ? 'is-invalid' : ''}
                onChange={event => updateField('tkId', event.target.value)}
              />
            </div>
          </div>
          <div className="row mt-3">
            <div className="field full" style={{ gridColumn: '1/-1' }}>
              <label>商品名称</label>
              <Input name="name" value={draft.name} onChange={event => updateField('name', event.target.value)} />
            </div>
          </div>
          <div className="row mt-3">
            <div className="field">
              <label>1688 链接</label>
              <Input type="url" name="link1688" placeholder="https://detail.1688.com/..." value={draft.link1688} onChange={event => updateField('link1688', event.target.value)} />
            </div>
            <div className="field">
              <label>图片 URL</label>
              <Input type="url" name="imageUrl" placeholder="https://..." value={draft.imageUrl} onChange={event => updateField('imageUrl', event.target.value)} />
            </div>
          </div>
          <div className="row mt-3">
            <div className="field full" style={{ gridColumn: '1/-1' }}>
              <label>货物类型</label>
              <Select name="cargoType" value={draft.cargoType} onChange={event => updateField('cargoType', event.target.value)}>
                <option value="general">普货</option>
                <option value="special">特货</option>
              </Select>
            </div>
          </div>

          <div className="pl-sku-panel">
            <div className="pl-sku-header">
              <div>
                <div className="pl-sku-title">SKU规格</div>
                <div className="pl-sku-copy">先生成 SKU，再根据实际情况统一设置或按分组调整物流参数。</div>
              </div>
            </div>
            <div className="pl-sku-actions">
              <Button size="sm" id="pl-add-sku" onClick={onAddSku}>+ 新增单个SKU</Button>
              <Button size="sm" id="pl-open-sku-batch" aria-expanded={batchOpen ? 'true' : 'false'} onClick={() => onBatchOpenChange(!batchOpen)}>+ 新增多个SKU</Button>
            </div>
            <div className={cn('pl-sku-batch-tools', batchOpen ? 'show' : '')} id="pl-sku-batch-tools">
              <div className="pl-sku-batch-block">
                <div className="pl-sku-batch-title">批量生成多个 SKU</div>
                <div className="pl-sku-batch-copy">按颜色、尺寸等规格值自动组合生成，已有 SKU 不会重复追加。</div>
                <div className="row triple pl-sku-batch-row">
                  <div className="field">
                    <label>规格维度 1</label>
                    <Input id="pl-batch-axis-a" value={draft.axisA} placeholder="例如 白、黑、蓝" onChange={event => updateField('axisA', event.target.value)} />
                  </div>
                  <div className="field">
                    <label>规格维度 2</label>
                    <Input id="pl-batch-axis-b" value={draft.axisB} placeholder="例如 S、M、L" onChange={event => updateField('axisB', event.target.value)} />
                  </div>
                  <div className="field">
                    <label>规格维度 3</label>
                    <Input id="pl-batch-axis-c" value={draft.axisC} placeholder="例如 普通款、升级款" onChange={event => updateField('axisC', event.target.value)} />
                  </div>
                </div>
                <div className="pl-sku-batch-actions">
                  <Button size="sm" variant="accentSoft" id="pl-generate-skus" onClick={onGenerateSkus}>生成多个 SKU</Button>
                </div>
              </div>
            </div>
            <div className="pl-sku-parameter-panel">
              <div className="pl-sku-batch-title">参数调整</div>
              <div className="pl-sku-batch-copy">留空匹配关键词就应用到全部 SKU；填写关键词则只更新命中的 SKU。</div>
              <div className="pl-sku-setup-block pl-sku-setup-block-single">
                <div className="pl-sku-setup-surface">
                  <div className="row pl-sku-batch-row">
                    <div className="field full" style={{ gridColumn: '1/-1' }}>
                      <label>匹配关键词（可选）</label>
                      <Input
                        id="pl-batch-match"
                        value={draft.matchText}
                        placeholder="例如 S 或 白 / S；留空则应用到全部 SKU"
                        onChange={event => updateField('matchText', event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="row pl-sku-batch-row mt-[10px]">
                    <div className="field">
                      <label>重量(g)</label>
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
                    </div>
                    <div className="field">
                      <label>尺寸(cm)</label>
                      <Input
                        id="pl-batch-size"
                        value={draft.defaultSizeText}
                        className={invalid.has('defaultSizeText') ? 'is-invalid' : ''}
                        placeholder="例如 20×15×10"
                        onChange={event => updateField('defaultSizeText', event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <SkuEditorList draft={draft} invalid={invalid} onSkuChange={updateSku} onRemoveSku={onRemoveSku} />
          </div>
          <div className="actions">
            <Button id="pl-cancel" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" variant="primary">保存</Button>
          </div>
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
  const pricingContext = useMemo(() => ensureGlobalSettingsStore(window).getPricingContext(), []);

  if (!draft.skus.length) {
    return <div className="pl-sku-list" id="pl-sku-list"><div className="pl-sku-empty">请先添加 SKU；每个 SKU 单独维护重量、尺寸和预估运费。</div></div>;
  }

  return (
    <div className="pl-sku-list" id="pl-sku-list">
      <div className="pl-sku-table-wrap">
        <table className="pl-sku-edit-table">
          <thead>
            <tr>
              <th>SKU 名称</th>
              <th>SKU ID</th>
              <th>重量(g)</th>
              <th>尺寸(cm)</th>
              <th>预估海外运费</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {draft.skus.map((sku, index) => {
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
                <tr className={cn('pl-sku-edit-row', useDefaults ? 'is-inheriting' : '')} data-sku-index={index} data-sku-use-defaults={useDefaults ? '1' : '0'} key={String(sku.skuId || index)}>
                  <td>
                    <Input
                      className={cn('pl-sku-inline-input', invalid.has(`sku.${index}.skuName`) ? 'is-invalid' : '')}
                      data-sku-field="skuName"
                      placeholder="例如 白 / S"
                      value={String(sku.skuName || '')}
                      onChange={event => onSkuChange(index, { skuName: event.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      className={cn('pl-sku-inline-input', invalid.has(`sku.${index}.skuId`) ? 'is-invalid' : '')}
                      data-sku-field="skuId"
                      value={String(sku.skuId || '')}
                      onChange={event => onSkuChange(index, { skuId: event.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      className={cn('pl-sku-inline-input', invalid.has(`sku.${index}.weightG`) ? 'is-invalid' : '')}
                      data-sku-field="weightG"
                      value={weightG}
                      onChange={event => onSkuChange(index, { weightG: event.target.value, useProductDefaults: false })}
                    />
                  </td>
                  <td>
                    <Input
                      className={cn('pl-sku-inline-input', invalid.has(`sku.${index}.sizeText`) ? 'is-invalid' : '')}
                      data-sku-field="sizeText"
                      placeholder="例如 20×15×10"
                      value={sizeText}
                      onChange={event => onSkuChange(index, { sizeText: event.target.value, useProductDefaults: false })}
                    />
                  </td>
                  <td>
                    <div className="pl-sku-fee-stack">
                      <span className="pl-sku-fee-value" data-sku-estimated-fee>{snapshot.estimatedShippingFee ? `¥ ${snapshot.estimatedShippingFee}` : '-'}</span>
                      <span className="pl-sku-fee-sub" data-sku-charge-weight>{snapshot.chargeWeightKg ? `计费重 ${snapshot.chargeWeightKg} kg` : ''}</span>
                      <span className="pl-sku-fee-note" data-sku-note>
                        {!useDefaults && sizeText.trim() && !dimensions.isComplete ? '尺寸请按 长×宽×高 填写' : snapshot.shippingNote}
                      </span>
                    </div>
                  </td>
                  <td className="pl-sku-cell-actions">
                    <Button size="sm" variant="danger" data-sku-remove={index} onClick={() => onRemoveSku(index)}>删除</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
  const allChecked = options.length > 0 && options.every(option => selected.has(option.key));
  return (
    <Dialog id="pl-export-modal" open={open} titleId="pl-export-title" onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: 460 }}>
        <DialogTitle id="pl-export-title">选择要导出的账号</DialogTitle>
        <div className="modal-copy mb-4">可勾选一个或多个账号；如果当前已经切到某个账号，会默认选中该账号。</div>
        <div className="ot-export-selectors">
          <label className="ot-export-option ot-export-option-all">
            <span className="ot-export-option-main">
              <input
                type="checkbox"
                id="pl-export-all"
                checked={allChecked}
                onChange={event => {
                  onSelectedChange(event.target.checked ? new Set(options.map(option => option.key)) : new Set());
                }}
              />
              <span>全部账号</span>
            </span>
          </label>
          <div id="pl-export-options" className="ot-export-options">
            {options.map(option => (
              <label className="ot-export-option" key={option.key}>
                <span className="ot-export-option-main">
                  <input
                    type="checkbox"
                    className="pl-export-checkbox"
                    value={option.key}
                    checked={selected.has(option.key)}
                    onChange={event => {
                      const next = new Set(selected);
                      if (event.target.checked) next.add(option.key);
                      else next.delete(option.key);
                      onSelectedChange(next);
                    }}
                  />
                  <span className="ot-export-option-name">{option.label}</span>
                </span>
                <span className="ot-export-option-count">{option.count} 个商品</span>
              </label>
            ))}
          </div>
        </div>
        <div className="actions">
          <Button id="pl-export-cancel" onClick={() => onOpenChange(false)}>取消</Button>
          <Button id="pl-export-confirm" variant="primary" onClick={onConfirm}>导出 CSV</Button>
        </div>
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

function ProductsPage() {
  const providerRef = useRef(ProductLibraryProviderFirestore.create({
    state: {},
    helpers: { nowIso: () => new Date().toISOString() }
  }));
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
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
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSelected, setExportSelected] = useState<Set<string>>(new Set());

  const allAccounts = useMemo(() => uniqueAccounts([
    ...accounts,
    ...products.map(product => product.accountName)
  ]).sort((left, right) => left.localeCompare(right)), [accounts, products]);

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
    },
    ui: {
      toast: showToast
    }
  }), [activeAccount, allAccounts, products, searchQuery, sortOrder]);

  const exportOptions = useMemo(
    () => productExporter.getProductExportAccountOptions(),
    [productExporter]
  );

  const notifyProductsChanged = useCallback((detail: Record<string, unknown> = {}) => {
    window.dispatchEvent(new CustomEvent('tk-products-changed', {
      detail: {
        source: 'products',
        projectId,
        ...detail
      }
    }));
  }, [projectId]);

  const formatFirestoreError = useCallback((error: unknown, fallback = '商品管理操作失败') => {
    const err = error as { code?: string; message?: string };
    const code = String(err?.code || '').trim();
    const message = String(err?.message || '').trim();
    if (code.includes('permission-denied') || /Missing or insufficient permissions/i.test(message)) {
      const next = '当前 Firebase 项目的 Firestore 规则还没放行 products 集合。请打开 Firebase Console → Firestore Database → Rules，重新复制并发布最新规则。';
      window.TKFirestoreConnection?.notifyRulesUpdateNeeded?.(next);
      return next;
    }
    return message || fallback;
  }, []);

  const loadProducts = useCallback(async () => {
    const result = await providerRef.current.pullProducts();
    setProducts(result.products || []);
    setAccounts(Array.isArray(result.accounts) ? result.accounts : []);
    setLoaded(true);
    setSyncText(`已同步 · ${(result.products || []).length} 个商品`);
    setSyncClass('saved');
  }, []);

  const connectUsingGlobalConfig = useCallback(async () => {
    const cfg = readGlobalConfig();
    if (!cfg?.configText) {
      setConnected(false);
      setLoaded(false);
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
    } finally {
      setLoading(false);
    }
  }, [loadProducts]);

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
    window.addEventListener('tk-firestore-config-changed', handleConnectionChange);
    return () => window.removeEventListener('tk-firestore-config-changed', handleConnectionChange);
  }, [connectUsingGlobalConfig, formatFirestoreError]);

  useEffect(() => {
    if (activeAccount === '__all__' || allAccounts.includes(activeAccount)) return;
    setActiveAccount('__all__');
  }, [activeAccount, allAccounts]);

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
      if (window.TKFirestoreConnection?.copyText) await window.TKFirestoreConnection.copyText(text);
      else await navigator.clipboard.writeText(text);
      showToast('链接已复制');
    } catch (error) {
      showToast((error as Error)?.message || '复制失败', 'error');
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
        pricingContext: ensureGlobalSettingsStore(window).getPricingContext(),
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
        pricingContext: ensureGlobalSettingsStore(window).getPricingContext(),
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
        weightG: useDefaults ? '' : String(snapshot.weightG || weightG),
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
      const saved = result?.product || result;
      setProducts(previous => [...previous.filter(item => item.tkId !== saved.tkId), saved]);
      notifyProductsChanged({ action: 'upsert', tkId: saved?.tkId || payload.tkId });
      result?.commitPromise?.then(() => {
        notifyProductsChanged({ action: 'commit', tkId: saved?.tkId || payload.tkId });
      }).catch(() => {});
      setModalOpen(false);
      setEditingTkId('');
      showToast('商品已保存');
    } catch (error) {
      showToast(formatFirestoreError(error, '商品保存失败'), 'error');
    }
  }

  async function deleteProduct(tkId: string) {
    if (!window.confirm('确定删除这个商品？')) return;
    try {
      const result = await providerRef.current.deleteProduct(tkId, { waitForCommit: false });
      setProducts(previous => previous.filter(item => item.tkId !== tkId));
      notifyProductsChanged({ action: 'delete', tkId });
      result?.commitPromise?.then(() => {
        notifyProductsChanged({ action: 'commit', tkId });
      }).catch(() => {});
      showToast('商品已删除');
    } catch (error) {
      showToast(formatFirestoreError(error, '商品删除失败'), 'error');
    }
  }

  function openExportModal() {
    if (!exportOptions.length) {
      showToast('当前没有可导出的商品数据', 'error');
      return;
    }
    const defaultSelected = activeAccount && activeAccount !== '__all__'
      ? new Set([activeAccount])
      : new Set(exportOptions.map(option => option.key));
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
    const headers = ['账号', 'TK ID', '商品名称', '货物类型', 'SKU 名称', 'SKU ID', '重量(g)', '尺寸(cm)', '单件预估海外运费(元)', '1688 链接', '图片 URL', '创建时间', '更新时间'];
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
      <Card id="pl-disconnected" className="card" style={{ display: connected ? 'none' : undefined }}>
        <div className="ot-setup-content">
          <h2>商品管理</h2>
          <p>先连接你的 Firebase Firestore。商品和订单共用同一个 Firebase 项目，本站不保存你的商品资料。</p>
          <Button id="pl-open-connection" variant="primary" onClick={() => window.TKFirestoreConnection?.open?.()}>连接 Firebase</Button>
        </div>
      </Card>

      <div id="pl-main" style={{ display: connected ? undefined : 'none' }}>
        <div className="ot-header-status-row flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="muted min-w-0 flex-1 truncate max-[640px]:basis-full max-[640px]:whitespace-normal" id="pl-user">
            {projectId ? `已连接 · ${projectId} · Firestore` : '已连接 · Firebase Firestore'}
          </div>
          <div className="ot-header-actions flex flex-wrap items-center justify-end gap-2 max-[640px]:w-full max-[640px]:justify-start">
            <span id="pl-sync" className={`sync ${syncClass} inline-flex min-h-[30px] items-center whitespace-nowrap`}>{syncText}</span>
            <Button
              id="pl-refresh"
              size="sm"
              className="ot-refresh-inline"
              disabled={loading}
              aria-busy={loading ? 'true' : 'false'}
              onClick={() => void loadProducts().catch(error => {
                showToast(formatFirestoreError(error, '刷新失败'), 'error');
                setSyncText('刷新失败');
                setSyncClass('error');
              })}
            >
              <RefreshCw size={14} strokeWidth={2} aria-hidden="true" className={loading ? 'is-spinning' : ''} />
              刷新
            </Button>
            <Button id="pl-export" size="sm" onClick={openExportModal}><FileDown size={14} strokeWidth={2} aria-hidden="true" />导出 CSV</Button>
            <Button id="pl-disconnect-firestore" size="sm" variant="danger" data-firestore-disconnect onClick={() => window.TKFirestoreConnection?.requestDisconnect?.()}>退出数据库</Button>
          </div>
        </div>

        <div className="ot-account-tabs-row pl-account-tabs-row flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3 mb-3 max-[768px]:flex-col max-[768px]:items-stretch">
          <div className="ot-acc-tabs flex min-w-0 flex-1 items-center gap-2 border-0 p-0" id="pl-acc-tabs">
            <div id="pl-acc-tabs-all" className="shrink-0">
              <button
                type="button"
                className={cn('tab', activeAccount === '__all__' ? 'active' : '')}
                data-pl-acc="__all__"
                onClick={() => { setActiveAccount('__all__'); setCurrentPage(1); }}
              >
                全部<span className="tab-count">({products.length})</span>
              </button>
            </div>
            <div id="pl-acc-tabs-scroll" className="ot-acc-tabs-scroll min-w-0 flex-1">
              <AccountTabs
                activeAccount={activeAccount}
                accounts={allAccounts}
                products={products}
                onChange={account => { setActiveAccount(account); setCurrentPage(1); }}
              />
            </div>
          </div>
          <div className="ot-acc-actions flex shrink-0 items-center justify-end gap-2 ml-0 max-[768px]:w-full" id="pl-acc-actions">
            <Button id="pl-add" variant="primary" onClick={() => openProductModal()}><Plus size={14} strokeWidth={2} aria-hidden="true" />新增商品</Button>
          </div>
        </div>

        <ProductsTableView
          products={products}
          activeAccount={activeAccount}
          searchQuery={searchQuery}
          sortOrder={sortOrder}
          pageSize={pageSize}
          currentPage={currentPage}
          expandedTkIds={expandedTkIds}
          onSearchChange={value => { setSearchQuery(value); setCurrentPage(1); }}
          onPageSizeChange={value => { setPageSize(Math.max(1, Number(value) || 50)); setCurrentPage(1); }}
          onPageChange={delta => setCurrentPage(page => Math.max(1, page + delta))}
          onSortToggle={() => { setSortOrder(value => value === 'asc' ? 'desc' : 'asc'); setCurrentPage(1); }}
          onToggleExpand={tkId => setExpandedTkIds(previous => ({ ...previous, [tkId]: !previous[tkId] }))}
          onCopyLink={copyLink}
          onEdit={openProductModal}
          onDelete={deleteProduct}
        />
      </div>

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
