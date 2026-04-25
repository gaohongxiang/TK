/* ============================================================
 * 商品库：表格视图
 * ============================================================ */
const ProductLibraryTableView = (function () {
  const tableControls = typeof TKTableControls !== 'undefined' ? TKTableControls : null;
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    ));
  }

  function normalizeSearchValue(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toNumber(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const parsed = Number.parseFloat(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatText(value) {
    const text = String(value ?? '').trim();
    return text || '-';
  }

  function formatMoney(value) {
    const amount = toNumber(value);
    return amount === null ? '-' : `¥ ${amount.toFixed(2)}`;
  }

  function getProductSkus(product) {
    return Array.isArray(product?.skus) ? product.skus.filter(sku => String(sku?.skuId || '').trim()) : [];
  }

  function getProductDefaults(product = {}) {
    return product?.defaults && typeof product.defaults === 'object'
      ? product.defaults
      : product;
  }

  function skuUsesProductDefaults(sku = {}) {
    if (sku?.useProductDefaults === true) return true;
    if (sku?.useProductDefaults === false) return false;
    const hasOwnSpec = !!String(sku?.weightG || '').trim()
      || !!String(sku?.sizeText || '').trim()
      || !!String(sku?.lengthCm || '').trim()
      || !!String(sku?.widthCm || '').trim()
      || !!String(sku?.heightCm || '').trim()
      || !!String(sku?.estimatedShippingFee || '').trim()
      || !!String(sku?.chargeWeightKg || '').trim()
      || !!String(sku?.shippingNote || '').trim();
    return !hasOwnSpec;
  }

  function mergeProductSku(product = {}, sku = {}) {
    const defaults = getProductDefaults(product);
    if (!skuUsesProductDefaults(sku)) return sku;
    return {
      ...product,
      ...defaults,
      ...sku,
      weightG: sku?.weightG || defaults?.weightG || '',
      lengthCm: sku?.lengthCm || defaults?.lengthCm || '',
      widthCm: sku?.widthCm || defaults?.widthCm || '',
      heightCm: sku?.heightCm || defaults?.heightCm || '',
      estimatedShippingFee: sku?.estimatedShippingFee || defaults?.estimatedShippingFee || '',
      chargeWeightKg: sku?.chargeWeightKg || defaults?.chargeWeightKg || '',
      shippingNote: sku?.shippingNote || defaults?.shippingNote || '',
      sizeText: sku?.sizeText || defaults?.sizeText || ''
    };
  }

  function formatSize(product) {
    const values = [product?.lengthCm, product?.widthCm, product?.heightCm]
      .map(toNumber)
      .filter(value => value !== null);
    return values.length === 3 ? values.join(' * ') : '-';
  }

  function formatWeight(value) {
    const amount = toNumber(value);
    return amount === null ? '-' : String(amount);
  }

  function formatSkuCount(product) {
    const count = getProductSkus(product).length;
    return count > 0 ? `${count} 个` : '-';
  }

  function formatSkuLabel(sku = {}) {
    const name = formatText(sku?.skuName);
    const skuId = String(sku?.skuId || '').trim();
    return skuId && skuId !== '-' ? `${name} · ${skuId}` : name;
  }

  function formatSkuShippingFee(product, sku) {
    const record = mergeProductSku(product, sku);
    return formatMoney(record?.estimatedShippingFee);
  }

  function renderExpandedSkus(product = {}) {
    const skus = getProductSkus(product);
    if (!skus.length) return '';
    return `
      <div class="pl-sku-expanded-surface">
        <div class="pl-sku-expanded-head">
          <div class="pl-sku-expanded-title">SKU 规格明细</div>
          <div class="pl-sku-expanded-copy">点击商品行可收起，订单选择商品时也会优先使用这里的 SKU 参数。</div>
        </div>
        <div class="pl-sku-expanded-table-wrap">
          <table class="pl-sku-expanded-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>重量(g)</th>
                <th>尺寸(cm)</th>
                <th>预估海外运费</th>
              </tr>
            </thead>
            <tbody>
          ${skus.map((sku, index) => {
            const record = mergeProductSku(product, sku);
            return `
              <tr>
                <td>
                  <div class="pl-sku-expanded-sku-main">${escapeHtml(formatSkuLabel(sku))}</div>
                </td>
                <td>${escapeHtml(formatWeight(record?.weightG))}</td>
                <td>${escapeHtml(formatSize(record))}</td>
                <td>${escapeHtml(formatSkuShippingFee(product, sku))}</td>
              </tr>`;
          }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function getCargoTypeLabel(value) {
    return value === 'special' ? '特货' : '普货';
  }

  function parseProductSortTime(product) {
    const value = String(product?.createdAt || product?.updatedAt || '').trim();
    const timestamp = Date.parse(value || 0);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function clampPage(currentPage, pageSize, totalItems) {
    if (tableControls?.clampPage) return tableControls.clampPage(currentPage, pageSize, totalItems);
    const safePageSize = Math.max(1, Number(pageSize) || 50);
    const totalPages = Math.max(1, Math.ceil((totalItems || 0) / safePageSize));
    const nextCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
    return { currentPage: nextCurrentPage, totalPages, pageSize: safePageSize };
  }

  function deriveDisplayedProducts({ products = [], activeAccount = '__all__', searchQuery = '', sortOrder = 'asc' } = {}) {
    const list = Array.isArray(products) ? products : [];
    const accountFiltered = activeAccount && activeAccount !== '__all__'
      ? list.filter(product => String(product?.accountName || '').trim() === activeAccount)
      : list;
    const compareProducts = (a, b) => {
      const leftTime = parseProductSortTime(a);
      const rightTime = parseProductSortTime(b);
      if (leftTime !== rightTime) return sortOrder === 'asc' ? leftTime - rightTime : rightTime - leftTime;
      const byTkId = String(a?.tkId ?? '').localeCompare(String(b?.tkId ?? ''), 'zh-Hans-CN', {
        numeric: true,
        sensitivity: 'base'
      });
      if (byTkId !== 0) return sortOrder === 'asc' ? byTkId : -byTkId;
      return 0;
    };
    const sortProducts = items => [...items].sort(compareProducts);
    const query = normalizeSearchValue(searchQuery);
    if (!query) {
      return sortProducts(accountFiltered);
    }
    return accountFiltered.filter(product => {
      const haystack = normalizeSearchValue([
        product?.accountName,
        product?.tkId,
        product?.name,
        product?.link1688,
        getCargoTypeLabel(getProductDefaults(product)?.cargoType),
        ...getProductSkus(product).flatMap(sku => [sku?.skuId, sku?.skuName])
      ].join(' '));
      return haystack.includes(query);
    }).sort(compareProducts);
  }

  function buildTableToolbarMarkup({ pageSize, currentPage, totalPages, searchQuery, pageSizeOptions, includeSearch = false, disabled = false } = {}) {
    if (tableControls?.buildTableToolbarMarkup) {
      return tableControls.buildTableToolbarMarkup({
        prefix: 'pl',
        pageSize,
        currentPage,
        totalPages,
        searchQuery,
        searchHint: '搜索 TK ID / 名称 / 1688 链接',
        pageSizeOptions,
        includeSearch,
        disabled
      }).replace('ot-table-toolbar ot-sticky-controls', 'ot-table-toolbar ot-sticky-controls pl-sticky-controls');
    }
    return '';
  }

  function bindTableToolbar(container, { totalPages, includeSearch = false, onSearchChange, onPageSizeChange, onPageChange } = {}) {
    if (!tableControls?.bindTableToolbar) return;
    tableControls.bindTableToolbar(container, {
      prefix: 'pl',
      totalPages,
      includeSearch,
      onSearchChange,
      onPageSizeChange,
      onPageChange
    });
  }

  function renderEmptyState({ toolbar, footerToolbar, wrap, hasQuery, pageSize, searchQuery, pageSizeOptions, activeAccount, onToolbarBind }) {
    if (toolbar) {
      toolbar.innerHTML = buildTableToolbarMarkup({
        pageSize,
        currentPage: 1,
        totalPages: 1,
        searchQuery,
        pageSizeOptions,
        includeSearch: true,
        disabled: true
      });
    }
    if (footerToolbar) {
      footerToolbar.innerHTML = buildTableToolbarMarkup({
        pageSize,
        currentPage: 1,
        totalPages: 1,
        searchQuery,
        pageSizeOptions,
        disabled: true
      });
    }
    if (!wrap) return;
    const message = hasQuery
      ? '没有匹配的商品'
      : (activeAccount && activeAccount !== '__all__')
        ? `账号「${escapeHtml(activeAccount)}」下还没有商品`
        : '还没有商品资料';
    wrap.innerHTML = `
      <div class="ot-empty">
        <div style="font-size:15px;margin-bottom:6px">${message}</div>
        <div style="font-size:12.5px">${hasQuery ? '试试更换关键词' : '点击右上角「+ 新增商品」开始记录'}</div>
      </div>`;
    if (typeof onToolbarBind === 'function') onToolbarBind(1);
  }

  function render({
    toolbar,
    footerToolbar,
    wrap,
    products = [],
    activeAccount = '__all__',
    searchQuery = '',
    sortOrder = 'asc',
    pageSize = 50,
    currentPage = 1,
    expandedTkIds = {},
    pageSizeOptions = [],
    onSearchChange,
    onPageSizeChange,
    onPageChange,
    onSortToggle,
    onToggleExpand,
    onCopyLink,
    onEdit,
    onDelete
  } = {}) {
    const displayed = deriveDisplayedProducts({ products, activeAccount, searchQuery, sortOrder });
    const pageState = clampPage(currentPage, pageSize, displayed.length);
    const bindTopToolbar = totalPages => {
      bindTableToolbar(toolbar, {
        totalPages,
        includeSearch: true,
        onSearchChange,
        onPageSizeChange,
        onPageChange
      });
    };

    if (!displayed.length) {
      renderEmptyState({
        toolbar,
        footerToolbar,
        wrap,
        hasQuery: !!normalizeSearchValue(searchQuery),
        pageSize: pageState.pageSize,
        searchQuery,
        pageSizeOptions,
        activeAccount,
        onToolbarBind: bindTopToolbar
      });
      return { currentPage: 1, totalPages: 1 };
    }

    const startIndex = (pageState.currentPage - 1) * pageState.pageSize;
    const paged = displayed.slice(startIndex, startIndex + pageState.pageSize);
    const sortIcon = sortOrder === 'asc' ? '↑' : '↓';
    const sortTitle = sortOrder === 'asc' ? '当前正序，点击切换' : '当前倒序，点击切换';

    const columnCount = 8 + (activeAccount === '__all__' ? 1 : 0);
    const rows = paged.map((product, index) => {
      const absoluteIndex = startIndex + index;
      const seqNum = sortOrder === 'asc' ? absoluteIndex + 1 : displayed.length - absoluteIndex;
      const skuCount = getProductSkus(product).length;
      const isExpandable = skuCount > 1;
      const isExpanded = !!expandedTkIds[String(product?.tkId || '').trim()];
      const rowClasses = [
        isExpandable ? 'pl-product-row is-expandable' : 'pl-product-row',
        isExpanded ? 'is-expanded' : ''
      ].filter(Boolean).join(' ');
      return `
      <tr class="${rowClasses}" ${isExpandable ? `data-toggle-expand="${escapeHtml(product?.tkId)}"` : ''}>
        <td class="mono">
          <div class="pl-row-seq">
            <span>${seqNum}</span>
            ${isExpandable ? `<span class="pl-expand-caret" aria-hidden="true">${isExpanded ? '▾' : '▸'}</span>` : ''}
          </div>
        </td>
        <td class="pl-image-cell">${product?.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product?.name || product?.tkId || '商品图片')}" class="pl-image">` : '<span class="pl-image-placeholder">-</span>'}</td>
        ${activeAccount === '__all__' ? `<td><span class="chip muted">${escapeHtml(formatText(product?.accountName))}</span></td>` : ''}
        <td class="mono">${escapeHtml(formatText(product?.tkId))}</td>
        <td>
          <div>${escapeHtml(formatText(product?.name))}</div>
        </td>
        <td>${escapeHtml(getCargoTypeLabel(getProductDefaults(product)?.cargoType))}</td>
        <td>
          <span class="pl-sku-count-pill${isExpandable ? ' is-expandable' : ''}"${isExpandable ? ' title="点击展开 SKU 明细"' : ''}>
            ${escapeHtml(formatSkuCount(product))}
          </span>
        </td>
        <td>
          ${product?.link1688 ? `
            <div class="pl-link-actions">
              <a class="btn sm" href="${escapeHtml(product.link1688)}" target="_blank" rel="noreferrer">打开</a>
              <button class="btn sm" type="button" data-copy-link="${escapeHtml(product.link1688)}">复制</button>
            </div>
          ` : '-'}
        </td>
        <td>
          <button class="btn sm" data-edit="${escapeHtml(product?.tkId)}">编辑</button>
          <button class="btn sm danger" data-del="${escapeHtml(product?.tkId)}">删除</button>
        </td>
      </tr>
      ${isExpandable && isExpanded ? `
        <tr class="pl-sku-detail-row">
          <td colspan="${columnCount}">${renderExpandedSkus(product)}</td>
        </tr>` : ''}`;
    }).join('');

    if (toolbar) {
      toolbar.innerHTML = buildTableToolbarMarkup({
        pageSize: pageState.pageSize,
        currentPage: pageState.currentPage,
        totalPages: pageState.totalPages,
        searchQuery,
        pageSizeOptions,
        includeSearch: true
      });
    }
    if (footerToolbar) {
      footerToolbar.innerHTML = buildTableToolbarMarkup({
        pageSize: pageState.pageSize,
        currentPage: pageState.currentPage,
        totalPages: pageState.totalPages,
        searchQuery,
        pageSizeOptions
      });
    }

    if (wrap) {
      wrap.innerHTML = `
        <div class="ot-table-inner">
          <table class="ot pl-table">
            <thead>
              <tr>
                <th><span id="pl-sort-btn" title="${escapeHtml(sortTitle)}" style="cursor:pointer;user-select:none"># ${escapeHtml(sortIcon)}</span></th>
                <th>图片</th>
                ${activeAccount === '__all__' ? '<th>账号</th>' : ''}
                <th>TK ID</th>
                <th>商品名称</th>
                <th>货物类型</th>
                <th>SKU数</th>
                <th>1688</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;

      Array.from(wrap.querySelectorAll('[data-edit]')).forEach(button => {
        button.addEventListener('click', () => {
          if (typeof onEdit === 'function') onEdit(button.dataset.edit);
        });
      });
      Array.from(wrap.querySelectorAll('[data-del]')).forEach(button => {
        button.addEventListener('click', () => {
          if (typeof onDelete === 'function') onDelete(button.dataset.del);
        });
      });
      Array.from(wrap.querySelectorAll('[data-copy-link]')).forEach(button => {
        button.addEventListener('click', () => {
          if (typeof onCopyLink === 'function') onCopyLink(button.dataset.copyLink || '');
        });
      });
      Array.from(wrap.querySelectorAll('[data-toggle-expand]')).forEach(row => {
        row.addEventListener('click', event => {
          if (event.target?.closest('button, a, input, select, textarea, label')) return;
          if (typeof onToggleExpand === 'function') onToggleExpand(row.dataset.toggleExpand || '');
        });
      });
    }
    const sortBtn = wrap?.querySelector('#pl-sort-btn');
    if (sortBtn) {
      sortBtn.addEventListener('click', () => {
        if (typeof onSortToggle === 'function') onSortToggle();
      });
    }

    bindTableToolbar(toolbar, {
      totalPages: pageState.totalPages,
      includeSearch: true,
      onSearchChange,
      onPageSizeChange,
      onPageChange
    });
    bindTableToolbar(footerToolbar, {
      totalPages: pageState.totalPages,
      onPageSizeChange,
      onPageChange
    });

    return {
      currentPage: pageState.currentPage,
      totalPages: pageState.totalPages
    };
  }

  return {
    deriveDisplayedProducts,
    render
  };
})();
