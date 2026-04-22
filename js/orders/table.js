/* ============================================================
 * 订单跟踪器：订单表格视图
 * ============================================================ */
const OrderTableView = (function () {
  let helpDismissBound = false;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    ));
  }

  function normalizeSearchValue(value) {
    return String(value || '').trim().toLowerCase();
  }

  function parsePurchaseAmount(value) {
    const normalized = String(value ?? '').replace(/,/g, '').trim();
    if (!normalized) return 0;
    const amount = Number.parseFloat(normalized);
    return Number.isFinite(amount) ? amount : 0;
  }

  function sumPurchaseAmount(orders = []) {
    return (Array.isArray(orders) ? orders : []).reduce((sum, order) => (
      sum + parsePurchaseAmount(order?.['采购价格'])
    ), 0);
  }

  function formatCurrencyAmount(value) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    return `¥ ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function deriveDisplayedOrders({ orders = [], activeAccount = '__all__', searchQuery = '', sortOrder = 'asc' } = {}) {
    const list = Array.isArray(orders) ? orders : [];
    const isAll = activeAccount === '__all__';
    const accountFiltered = isAll
      ? list
      : activeAccount
        ? list.filter(order => String(order?.['账号'] || '').trim() === activeAccount)
        : list;
    const query = normalizeSearchValue(searchQuery);
    const filtered = !query
      ? accountFiltered
      : accountFiltered.filter(order => {
        const haystack = normalizeSearchValue([
          order?.['账号'],
          order?.['下单时间'],
          order?.['采购日期'],
          order?.['最晚到仓时间'],
          order?.['订单号'],
          order?.['产品名称'],
          order?.['数量'],
          order?.['采购价格'],
          order?.['重量'],
          order?.['尺寸'],
          order?.['订单状态'],
          order?.['快递公司'],
          order?.['快递单号']
        ].join(' '));
        return haystack.includes(query);
      });
    const allIds = list.map(order => order?.id);
    const sorted = [...filtered].sort((a, b) => {
      const ia = allIds.indexOf(a?.id);
      const ib = allIds.indexOf(b?.id);
      return sortOrder === 'asc' ? ib - ia : ia - ib;
    });
    return { isAll, sorted };
  }

  function derivePurchaseSummary({ orders = [], activeAccount = '__all__', searchQuery = '', sortOrder = 'asc' } = {}) {
    const list = Array.isArray(orders) ? orders : [];
    const { sorted } = deriveDisplayedOrders({ orders: list, activeAccount, searchQuery, sortOrder });
    return {
      filteredCount: sorted.length,
      allCount: list.length,
      filteredTotal: sumPurchaseAmount(sorted),
      allTotal: sumPurchaseAmount(list)
    };
  }

  function clampPage(currentPage, pageSize, totalItems) {
    const safePageSize = Math.max(1, Number(pageSize) || 50);
    const totalPages = Math.max(1, Math.ceil((totalItems || 0) / safePageSize));
    const nextCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
    return { currentPage: nextCurrentPage, totalPages, pageSize: safePageSize };
  }

  function captureSearchInputState() {
    if (typeof document === 'undefined') return null;
    const active = document.activeElement;
    if (!active || active.id !== 'ot-table-search-input') return null;
    const value = active.value || '';
    return {
      selectionStart: active.selectionStart ?? value.length,
      selectionEnd: active.selectionEnd ?? value.length
    };
  }

  function restoreSearchInputState(snapshot, container) {
    if (!snapshot || !container) return;
    const nextInput = container.querySelector('#ot-table-search-input');
    if (!nextInput) return;
    nextInput.focus();
    const valueLength = (nextInput.value || '').length;
    const selectionStart = Math.min(snapshot.selectionStart ?? valueLength, valueLength);
    const selectionEnd = Math.min(snapshot.selectionEnd ?? valueLength, valueLength);
    try {
      nextInput.setSelectionRange(selectionStart, selectionEnd);
    } catch (e) { }
  }

  function closeOpenHelp(except = null) {
    if (typeof document === 'undefined') return;
    Array.from(document.querySelectorAll('.ot-th-help[data-open="true"]')).forEach(help => {
      if (except && help === except) return;
      help.dataset.open = 'false';
      const trigger = help.querySelector('[data-help-trigger]');
      if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function ensureHelpDismissBinding() {
    if (helpDismissBound || typeof document === 'undefined') return;
    document.addEventListener('click', event => {
      if (event.target.closest('.ot-th-help')) return;
      closeOpenHelp();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeOpenHelp();
    });
    helpDismissBound = true;
  }

  function buildSummaryMarkup(summary) {
    return `
      <div class="ot-summary-grid">
        <div class="ot-summary-card">
          <div class="ot-summary-label">当前筛选采购总额</div>
          <div class="ot-summary-value">${escapeHtml(formatCurrencyAmount(summary.filteredTotal))}</div>
          <div class="ot-summary-meta">受账号标签和搜索影响 · 共 ${escapeHtml(summary.filteredCount)} 条</div>
        </div>
        <div class="ot-summary-card">
          <div class="ot-summary-label">全部订单采购总额</div>
          <div class="ot-summary-value">${escapeHtml(formatCurrencyAmount(summary.allTotal))}</div>
          <div class="ot-summary-meta">不受账号、搜索、分页影响 · 共 ${escapeHtml(summary.allCount)} 条</div>
        </div>
      </div>`;
  }

  function buildTableToolbarMarkup({ pageSize, currentPage, totalPages, searchQuery, pageSizeOptions, includeSearch = false, disabled = false }) {
    const searchMarkup = includeSearch ? `
      <div class="ot-table-toolbar-left">
        <label class="ot-table-search">
          <span class="ot-table-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="6"></circle>
              <path d="M16 16L20 20"></path>
            </svg>
          </span>
          <input id="ot-table-search-input" type="text" placeholder=" " value="${escapeHtml(searchQuery)}" autocomplete="off">
          <span class="ot-table-search-hint">搜索订单号 / 产品 / 快递</span>
        </label>
      </div>` : '';

    const paginationMarkup = `
      <div class="ot-table-pagination">
        <label class="ot-page-size">
          <span>每页</span>
          <span class="ot-page-size-control">
            <select id="${includeSearch ? 'ot-page-size' : 'ot-page-size-bottom'}">
              ${(pageSizeOptions || []).map(size => `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size}</option>`).join('')}
            </select>
          </span>
        </label>
        <button class="btn sm" id="${includeSearch ? 'ot-page-prev' : 'ot-page-prev-bottom'}" ${disabled || currentPage <= 1 ? 'disabled' : ''}>上一页</button>
        <span class="ot-page-indicator">${currentPage} / ${totalPages}</span>
        <button class="btn sm" id="${includeSearch ? 'ot-page-next' : 'ot-page-next-bottom'}" ${disabled || currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
      </div>`;

    return `
      <div class="ot-table-toolbar${includeSearch ? ' ot-sticky-controls' : ' ot-table-toolbar-bottom'}">
        <div class="ot-sticky-controls-inner">
          ${searchMarkup}
          <div class="ot-table-toolbar-right">
            ${paginationMarkup}
          </div>
        </div>
      </div>`;
  }

  function bindTableToolbar(container, { totalPages, includeSearch = false, getSearchComposing, onSearchCompositionStart, onSearchCompositionEnd, onSearchChange, onPageSizeChange, onPageChange } = {}) {
    if (!container) return;
    const searchInput = includeSearch ? container.querySelector('#ot-table-search-input') : null;
    if (searchInput) {
      searchInput.addEventListener('compositionstart', () => {
        if (typeof onSearchCompositionStart === 'function') onSearchCompositionStart();
      });
      searchInput.addEventListener('compositionend', () => {
        if (typeof onSearchCompositionEnd === 'function') onSearchCompositionEnd(searchInput.value);
      });
      searchInput.addEventListener('input', event => {
        if (event.isComposing || (typeof getSearchComposing === 'function' && getSearchComposing())) return;
        if (typeof onSearchChange === 'function') onSearchChange(searchInput.value);
      });
    }
    const pageSizeSelect = container.querySelector(includeSearch ? '#ot-page-size' : '#ot-page-size-bottom');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', () => {
        if (typeof onPageSizeChange === 'function') onPageSizeChange(pageSizeSelect.value);
      });
    }
    const prevBtn = container.querySelector(includeSearch ? '#ot-page-prev' : '#ot-page-prev-bottom');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (typeof onPageChange === 'function') onPageChange(-1, totalPages);
      });
    }
    const nextBtn = container.querySelector(includeSearch ? '#ot-page-next' : '#ot-page-next-bottom');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (typeof onPageChange === 'function') onPageChange(1, totalPages);
      });
    }
  }

  function buildHelpBubbleMarkup({ id, label, lines }) {
    return `
      <span class="ot-th-help" data-help-id="${escapeHtml(id)}" data-open="false">
        <span class="ot-th-help-label">${escapeHtml(label)}</span>
        <button type="button" class="ot-th-help-trigger" data-help-trigger aria-label="${escapeHtml(label)}说明" aria-expanded="false">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="7.2"></circle>
            <path d="M10 8.4v4.2"></path>
            <circle cx="10" cy="5.6" r=".8" fill="currentColor" stroke="none"></circle>
          </svg>
        </button>
        <span class="ot-th-help-bubble" role="tooltip">
          ${lines.map(line => `<span class="ot-th-help-line">${escapeHtml(line)}</span>`).join('')}
        </span>
      </span>`;
  }

  function buildTableHeadMarkup({ isAll, sortIcon, sortTitle }) {
    return `
      <tr>
        <th><span id="ot-sort-btn" title="${escapeHtml(sortTitle)}" style="cursor:pointer;user-select:none"># ${escapeHtml(sortIcon)}</span></th>
        ${isAll ? '<th>账号</th>' : ''}
        <th>下单时间</th>
        <th>采购日期</th>
        <th>${buildHelpBubbleMarkup({
          id: 'warehouse',
          label: '最晚到仓',
          lines: ['最晚到仓 = 下单时间 + 6 天']
        })}</th>
        <th>${buildHelpBubbleMarkup({
          id: 'warning',
          label: '订单预警',
          lines: [
            '订单取消 → 取消订单',
            '已入仓 → 入仓完成',
            '已完成 → 订单完成',
            '已送达 → 订单送达',
            '今天 ≥ 最晚到仓 → 已超期',
            '最晚到仓 - 今天 ≤ 2 天 → 延误风险',
            '最晚到仓 - 今天 > 2 天 → 剩 N 天'
          ]
        })}</th>
        <th>订单号</th>
        <th>产品名称</th>
        <th>数量</th>
        <th>采购价(元)</th>
        <th>重量</th>
        <th>尺寸</th>
        <th>订单状态</th>
        <th>快递公司</th>
        <th>快递单号</th>
        <th>操作</th>
      </tr>`;
  }

  function renderEmptyState({ toolbar, footerToolbar, wrap, hasQuery, pageSize, searchQuery, pageSizeOptions, activeAccount, onToolbarBind }) {
    if (toolbar) {
      toolbar.innerHTML = hasQuery
        ? buildTableToolbarMarkup({
          pageSize,
          currentPage: 1,
          totalPages: 1,
          searchQuery,
          pageSizeOptions,
          includeSearch: true,
          disabled: true
        })
        : '';
    }
    if (footerToolbar) footerToolbar.innerHTML = '';
    if (!wrap) return;
    const msg = hasQuery
      ? '没有匹配的订单'
      : (activeAccount && activeAccount !== '__all__')
        ? `账号「${escapeHtml(activeAccount)}」下还没有订单`
        : '还没有订单';
    wrap.innerHTML = `
      <div class="ot-empty">
        <div style="font-size:15px;margin-bottom:6px">${msg}</div>
        <div style="font-size:12.5px">${hasQuery ? '试试更换关键词' : '点击右上角「+ 新增订单」开始记录'}</div>
      </div>`;
    if (typeof onToolbarBind === 'function') onToolbarBind(1);
  }

  function renderRows({ paged, startIndex, total, sortOrder, isAll, computeWarning }) {
    return paged.map((order, index) => {
      const absoluteIndex = startIndex + index;
      const seqNum = sortOrder === 'asc' ? absoluteIndex + 1 : total - absoluteIndex;
      const warn = typeof computeWarning === 'function' ? computeWarning(order) : { cls: '', text: '' };
      return `
        <tr>
          <td style="color:var(--muted)">${seqNum}</td>
          ${isAll ? `<td><span class="chip muted">${escapeHtml(order?.['账号'] || '-')}</span></td>` : ''}
          <td>${escapeHtml(order?.['下单时间'])}</td>
          <td>${escapeHtml(order?.['采购日期'])}</td>
          <td>${escapeHtml(order?.['最晚到仓时间'])}</td>
          <td><span class="chip ${escapeHtml(warn.cls || '')}">${escapeHtml(warn.text || '')}</span></td>
          <td>${escapeHtml(order?.['订单号'])}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(order?.['产品名称'])}">${escapeHtml(order?.['产品名称'])}</td>
          <td>${escapeHtml(order?.['数量'])}</td>
          <td>${escapeHtml(order?.['采购价格'])}</td>
          <td>${escapeHtml(order?.['重量'])}</td>
          <td>${escapeHtml(order?.['尺寸'])}</td>
          <td>${escapeHtml(order?.['订单状态'])}</td>
          <td>${escapeHtml(order?.['快递公司'])}</td>
          <td>${escapeHtml(order?.['快递单号'])}</td>
          <td>
            <button class="btn sm" data-edit="${escapeHtml(order?.id)}">编辑</button>
            <button class="btn sm danger" data-del="${escapeHtml(order?.id)}">删除</button>
          </td>
        </tr>`;
    }).join('');
  }

  function bindTableHelp(container) {
    if (!container) return;
    ensureHelpDismissBinding();
    Array.from(container.querySelectorAll('[data-help-trigger]')).forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const help = button.closest('.ot-th-help');
        if (!help) return;
        const willOpen = help.dataset.open !== 'true';
        closeOpenHelp(help);
        help.dataset.open = willOpen ? 'true' : 'false';
        button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (!willOpen) button.blur();
      });
    });
  }

  function render({
    summaryContainer,
    toolbar,
    footerToolbar,
    wrap,
    orders = [],
    activeAccount = '__all__',
    searchQuery = '',
    pageSize = 50,
    currentPage = 1,
    sortOrder = 'asc',
    pageSizeOptions = [],
    computeWarning,
    getSearchComposing,
    onSearchCompositionStart,
    onSearchCompositionEnd,
    onSearchChange,
    onPageSizeChange,
    onPageChange,
    onSortToggle,
    onEdit,
    onDelete
  } = {}) {
    closeOpenHelp();
    const searchInputState = captureSearchInputState();
    const { isAll, sorted } = deriveDisplayedOrders({ orders, activeAccount, searchQuery, sortOrder });
    const summary = derivePurchaseSummary({ orders, activeAccount, searchQuery, sortOrder });
    const hasQuery = !!normalizeSearchValue(searchQuery);
    const pageState = clampPage(currentPage, pageSize, sorted.length);

    if (summaryContainer) {
      summaryContainer.innerHTML = buildSummaryMarkup(summary);
    }

    const bindTopToolbar = totalPages => {
      bindTableToolbar(toolbar, {
        totalPages,
        includeSearch: true,
        getSearchComposing,
        onSearchCompositionStart,
        onSearchCompositionEnd,
        onSearchChange,
        onPageSizeChange,
        onPageChange
      });
      restoreSearchInputState(searchInputState, toolbar);
    };

    if (!sorted.length) {
      renderEmptyState({
        toolbar,
        footerToolbar,
        wrap,
        hasQuery,
        pageSize: pageState.pageSize,
        searchQuery,
        pageSizeOptions,
        activeAccount,
        onToolbarBind: bindTopToolbar
      });
      return { currentPage: 1, totalPages: 1 };
    }

    const startIndex = (pageState.currentPage - 1) * pageState.pageSize;
    const paged = sorted.slice(startIndex, startIndex + pageState.pageSize);
    const rows = renderRows({
      paged,
      startIndex,
      total: sorted.length,
      sortOrder,
      isAll,
      computeWarning
    });
    const sortIcon = sortOrder === 'asc' ? '↑' : '↓';
    const sortTitle = sortOrder === 'asc' ? '当前正序（最早在上），点击切换' : '当前倒序（最新在上），点击切换';

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
          <table class="ot">
            <thead>${buildTableHeadMarkup({ isAll, sortIcon, sortTitle })}</thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    bindTableToolbar(toolbar, {
      totalPages: pageState.totalPages,
      includeSearch: true,
      getSearchComposing,
      onSearchCompositionStart,
      onSearchCompositionEnd,
      onSearchChange,
      onPageSizeChange,
      onPageChange
    });
    bindTableToolbar(footerToolbar, {
      totalPages: pageState.totalPages,
      onPageSizeChange,
      onPageChange
    });
    restoreSearchInputState(searchInputState, toolbar);
    bindTableHelp(wrap);

    const sortBtn = wrap?.querySelector('#ot-sort-btn');
    if (sortBtn) {
      sortBtn.addEventListener('click', () => {
        if (typeof onSortToggle === 'function') onSortToggle();
      });
    }

    (wrap ? Array.from(wrap.querySelectorAll('[data-edit]')) : []).forEach(button => {
      button.onclick = () => {
        if (typeof onEdit === 'function') onEdit(button.dataset.edit);
      };
    });
    (wrap ? Array.from(wrap.querySelectorAll('[data-del]')) : []).forEach(button => {
      button.onclick = () => {
        if (typeof onDelete === 'function') onDelete(button.dataset.del);
      };
    });

    return {
      currentPage: pageState.currentPage,
      totalPages: pageState.totalPages
    };
  }

  return {
    deriveDisplayedOrders,
    derivePurchaseSummary,
    formatCurrencyAmount,
    render
  };
})();
