/* ============================================================
 * 表格搜索 / 分页共用控件
 * ============================================================ */
const TKTableControls = (function () {
  function clampPage(currentPage, pageSize, totalItems) {
    const safePageSize = Math.max(1, Number(pageSize) || 50);
    const totalPages = Math.max(1, Math.ceil((totalItems || 0) / safePageSize));
    const nextCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
    return { currentPage: nextCurrentPage, totalPages, pageSize: safePageSize };
  }

  function buildTableToolbarMarkup({
    prefix = 'table',
    pageSize,
    currentPage,
    totalPages,
    searchQuery = '',
    searchHint = '',
    pageSizeOptions = [],
    includeSearch = false,
    disabled = false
  } = {}) {
    const searchMarkup = includeSearch ? `
      <div class="ot-table-toolbar-left">
        <label class="ot-table-search">
          <span class="ot-table-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="6"></circle>
              <path d="M16 16L20 20"></path>
            </svg>
          </span>
          <input id="${prefix}-table-search-input" type="text" placeholder=" " value="${String(searchQuery ?? '').replace(/[&<>"']/g, char => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
          ))}" autocomplete="off">
          <span class="ot-table-search-hint">${String(searchHint || '').replace(/[&<>"']/g, char => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
          ))}</span>
        </label>
      </div>` : '';

    const paginationMarkup = `
      <div class="ot-table-pagination">
        <label class="ot-page-size">
          <span>每页</span>
          <span class="ot-page-size-control">
            <select id="${includeSearch ? `${prefix}-page-size` : `${prefix}-page-size-bottom`}">
              ${(pageSizeOptions || []).map(size => `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size}</option>`).join('')}
            </select>
          </span>
        </label>
        <button class="btn sm" id="${includeSearch ? `${prefix}-page-prev` : `${prefix}-page-prev-bottom`}" ${disabled || currentPage <= 1 ? 'disabled' : ''}>上一页</button>
        <span class="ot-page-indicator">${currentPage} / ${totalPages}</span>
        <button class="btn sm" id="${includeSearch ? `${prefix}-page-next` : `${prefix}-page-next-bottom`}" ${disabled || currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
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

  function bindTableToolbar(container, {
    prefix = 'table',
    totalPages,
    includeSearch = false,
    getSearchComposing,
    onSearchCompositionStart,
    onSearchCompositionEnd,
    onSearchChange,
    onPageSizeChange,
    onPageChange
  } = {}) {
    if (!container) return;
    const searchInput = includeSearch ? container.querySelector(`#${prefix}-table-search-input`) : null;
    if (searchInput) {
      if (typeof onSearchCompositionStart === 'function') {
        searchInput.addEventListener('compositionstart', () => onSearchCompositionStart());
      }
      if (typeof onSearchCompositionEnd === 'function') {
        searchInput.addEventListener('compositionend', () => onSearchCompositionEnd(searchInput.value));
      }
      searchInput.addEventListener('input', event => {
        if (event.isComposing || (typeof getSearchComposing === 'function' && getSearchComposing())) return;
        if (typeof onSearchChange === 'function') onSearchChange(searchInput.value);
      });
    }
    const pageSizeSelect = container.querySelector(includeSearch ? `#${prefix}-page-size` : `#${prefix}-page-size-bottom`);
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', () => {
        if (typeof onPageSizeChange === 'function') onPageSizeChange(pageSizeSelect.value);
      });
    }
    const prevBtn = container.querySelector(includeSearch ? `#${prefix}-page-prev` : `#${prefix}-page-prev-bottom`);
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (typeof onPageChange === 'function') onPageChange(-1, totalPages);
      });
    }
    const nextBtn = container.querySelector(includeSearch ? `#${prefix}-page-next` : `#${prefix}-page-next-bottom`);
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (typeof onPageChange === 'function') onPageChange(1, totalPages);
      });
    }
  }

  return {
    clampPage,
    buildTableToolbarMarkup,
    bindTableToolbar
  };
})();

window.TKTableControls = TKTableControls;
