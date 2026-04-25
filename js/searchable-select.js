const TKSearchSelect = (function () {
  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    ));
  }

  function create(root, { placeholder = '- 请选择 -', searchPlaceholder = '搜索', onChange } = {}) {
    if (!root) return null;
    const hiddenInput = root.querySelector('input[type="hidden"]');
    const trigger = root.querySelector('[data-role="trigger"]');
    const label = root.querySelector('[data-role="label"]');
    const panel = root.querySelector('[data-role="panel"]');
    const searchInput = root.querySelector('[data-role="search"]');
    const optionsWrap = root.querySelector('[data-role="options"]');
    if (!hiddenInput || !trigger || !label || !panel || !searchInput || !optionsWrap) return null;

    let options = [];
    let value = String(hiddenInput.value || '').trim();
    let disabled = false;
    let cleanupFloatingListeners = null;

    function getSelectedOption() {
      return options.find(option => String(option?.value || '') === value) || null;
    }

    function syncLabel() {
      const selected = getSelectedOption();
      label.textContent = selected?.label || placeholder;
      root.classList.toggle('is-empty', !selected);
      root.classList.toggle('is-disabled', !!disabled);
      trigger.disabled = !!disabled;
    }

    function close() {
      root.classList.remove('is-open');
      if (cleanupFloatingListeners) {
        cleanupFloatingListeners();
        cleanupFloatingListeners = null;
      }
    }

    function positionPanel() {
      const triggerRect = trigger.getBoundingClientRect();
      if (!triggerRect.width && !triggerRect.height) return;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const panelMaxHeight = 280;
      const spaceBelow = viewportHeight - triggerRect.bottom - 12;
      const spaceAbove = triggerRect.top - 12;
      const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
      const top = openAbove
        ? Math.max(12, triggerRect.top - Math.min(panelMaxHeight, Math.max(spaceAbove - 8, 160)))
        : Math.min(viewportHeight - 12, triggerRect.bottom + 8);
      panel.style.top = `${Math.round(top)}px`;
      panel.style.left = `${Math.round(Math.max(12, Math.min(triggerRect.left, viewportWidth - triggerRect.width - 12)))}px`;
      panel.style.width = `${Math.round(Math.max(triggerRect.width, 220))}px`;
      panel.style.maxHeight = `${Math.round(Math.max(160, openAbove ? spaceAbove - 8 : spaceBelow - 8))}px`;
    }

    function open() {
      if (disabled) return;
      root.classList.add('is-open');
      positionPanel();
      const handleFloatingUpdate = () => positionPanel();
      window.addEventListener('resize', handleFloatingUpdate);
      window.addEventListener('scroll', handleFloatingUpdate, true);
      cleanupFloatingListeners = () => {
        window.removeEventListener('resize', handleFloatingUpdate);
        window.removeEventListener('scroll', handleFloatingUpdate, true);
      };
      if (searchInput) {
        searchInput.value = '';
        renderOptions();
        requestAnimationFrame(() => searchInput.focus());
      }
    }

    function getFilteredOptions() {
      const query = normalizeText(searchInput.value);
      if (!query) return options;
      return options.filter(option => normalizeText(option?.searchText || option?.label || option?.value).includes(query));
    }

    function renderOptions() {
      const filtered = getFilteredOptions();
      if (!filtered.length) {
        optionsWrap.innerHTML = '<div class="tk-search-select-empty">没有匹配项</div>';
        return;
      }
      optionsWrap.innerHTML = filtered.map(option => `
        <button type="button" class="tk-search-select-option${String(option?.value || '') === value ? ' is-active' : ''}" data-option-value="${escapeHtml(option?.value || '')}">
          <span class="tk-search-select-option-label">${escapeHtml(option?.label || '')}</span>
        </button>
      `).join('');
    }

    function setOptions(nextOptions = []) {
      options = Array.isArray(nextOptions) ? nextOptions.map(option => ({
        value: String(option?.value || ''),
        label: String(option?.label || ''),
        searchText: String(option?.searchText || option?.label || option?.value || '')
      })) : [];
      const exists = options.some(option => option.value === value);
      if (!exists) value = '';
      hiddenInput.value = value;
      syncLabel();
      renderOptions();
    }

    function setValue(nextValue, { silent = false } = {}) {
      value = String(nextValue || '').trim();
      hiddenInput.value = value;
      syncLabel();
      renderOptions();
      if (!silent && typeof onChange === 'function') {
        onChange(value, getSelectedOption());
      }
    }

    function setDisabled(nextDisabled) {
      disabled = !!nextDisabled;
      if (disabled) close();
      syncLabel();
    }

    trigger.addEventListener('click', () => {
      if (root.classList.contains('is-open')) close();
      else open();
    });

    searchInput.placeholder = searchPlaceholder;
    searchInput.addEventListener('input', renderOptions);

    optionsWrap.addEventListener('click', event => {
      const optionButton = event.target.closest('[data-option-value]');
      if (!optionButton) return;
      setValue(optionButton.dataset.optionValue || '');
      close();
    });

    document.addEventListener('click', event => {
      if (!root.contains(event.target)) close();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && root.classList.contains('is-open')) close();
    });

    syncLabel();
    renderOptions();

    return {
      setOptions,
      setValue,
      getValue: () => value,
      setDisabled,
      close
    };
  }

  return {
    create
  };
})();

window.TKSearchSelect = TKSearchSelect;
