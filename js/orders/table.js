/* ============================================================
 * 订单跟踪器：订单表格视图
 * ============================================================ */
const OrderTableView = (function () {
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    ));
  }

  function normalizeSearchValue(value) {
    return String(value || '').trim().toLowerCase();
  }

  function deriveDisplayedOrders({ orders = [], activeAccount = '__all__', searchQuery = '', sortOrder = 'asc' } = {}) {
    const isAll = activeAccount === '__all__';
    const accountFiltered = isAll
      ? orders
      : activeAccount
        ? orders.filter(order => String(order?.['账号'] || '').trim() === activeAccount)
        : orders;
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
    const allIds = orders.map(order => order?.id);
    const sorted = [...filtered].sort((a, b) => {
      const ia = allIds.indexOf(a?.id);
      const ib = allIds.indexOf(b?.id);
      return sortOrder === 'asc' ? ib - ia : ia - ib;
    });
    return { isAll, sorted };
  }

  function clampPage(currentPage, pageSize, totalItems) {
    const safePageSize = Math.max(1, Number(pageSize) || 50);
    const totalPages = Math.max(1, Math.ceil((totalItems || 0) / safePageSize));
    const nextCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
    return { currentPage: nextCurrentPage, totalPages, pageSize: safePageSize };
  }

  function captureSearchInputState() {
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

  function buildTableToolbarMarkup({ pageSize, currentPage, totalPages, searchQuery, pageSizeOptions, includeSearch = false, disabled = false }) {
    return `
      <div class="ot-table-toolbar${includeSearch ? '' : ' ot-table-toolbar-bottom'}">
        <div class="ot-table-toolbar-right">
          ${includeSearch ? `
            <label class="ot-table-search">
              <span class="ot-table-search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="6"></circle>
                  <path d="M16 16L20 20"></path>
                </svg>
              </span>
              <input id="ot-table-search-input" type="text" placeholder=" " value="${escapeHtml(searchQuery)}" autocomplete="off">
              <span class="ot-table-search-hint">搜索订单号 / 产品 / 快递</span>
            </label>` : ''}
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

  function render({
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
    const searchInputState = captureSearchInputState();
    const { isAll, sorted } = deriveDisplayedOrders({ orders, activeAccount, searchQuery, sortOrder });
    const hasQuery = !!normalizeSearchValue(searchQuery);
    const pageState = clampPage(currentPage, pageSize, sorted.length);

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
            <thead>
              <tr>
                <th><span id="ot-sort-btn" title="${sortTitle}" style="cursor:pointer;user-select:none"># ${sortIcon}</span></th>${isAll ? '<th>账号</th>' : ''}<th>下单时间</th><th>采购日期</th><th>最晚到仓</th>
                <th>订单预警</th><th>订单号</th><th>产品名称</th>
                <th>数量</th><th>采购价(元)</th><th>重量</th><th>尺寸</th><th>订单状态</th>
                <th>快递公司</th><th>快递单号</th><th>操作</th>
              </tr>
            </thead>
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
    render
  };
})();
