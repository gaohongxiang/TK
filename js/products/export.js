/* ============================================================
 * 商品库：CSV 导出
 * ============================================================ */
const ProductLibraryExport = (function () {
  function fallbackEscapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    ));
  }

  function csvEscape(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function getProductDefaults(product = {}) {
    return product?.defaults && typeof product.defaults === 'object'
      ? product.defaults
      : product;
  }

  function getProductSkus(product = {}) {
    return Array.isArray(product?.skus)
      ? product.skus.filter(sku => String(sku?.skuId || sku?.skuName || '').trim())
      : [];
  }

  function skuUsesProductDefaults(sku = {}) {
    if (sku?.useProductDefaults === true) return true;
    if (sku?.useProductDefaults === false) return false;
    const hasOwnSpec = !!String(sku?.weightG || '').trim()
      || !!String(sku?.sizeText || '').trim()
      || !!String(sku?.lengthCm || '').trim()
      || !!String(sku?.widthCm || '').trim()
      || !!String(sku?.heightCm || '').trim()
      || !!String(sku?.estimatedShippingFee || '').trim();
    return !hasOwnSpec;
  }

  function toNumber(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const parsed = Number.parseFloat(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatSizeText(record = {}) {
    const direct = String(record?.sizeText || '').trim();
    if (direct) return direct.replace(/\*/g, '×');
    const values = [record?.lengthCm, record?.widthCm, record?.heightCm]
      .map(toNumber)
      .filter(value => value !== null);
    return values.length === 3 ? values.join('×') : '';
  }

  function mergeProductSku(product = {}, sku = {}) {
    const defaults = getProductDefaults(product);
    if (!skuUsesProductDefaults(sku)) return sku;
    return {
      ...defaults,
      ...sku,
      weightG: sku?.weightG || defaults?.weightG || '',
      lengthCm: sku?.lengthCm || defaults?.lengthCm || '',
      widthCm: sku?.widthCm || defaults?.widthCm || '',
      heightCm: sku?.heightCm || defaults?.heightCm || '',
      estimatedShippingFee: sku?.estimatedShippingFee || defaults?.estimatedShippingFee || '',
      sizeText: sku?.sizeText || defaults?.sizeText || ''
    };
  }

  function create({ state, helpers = {}, ui = {} } = {}) {
    const escapeHtml = helpers.escapeHtml || (value => (
      typeof TKHtml !== 'undefined' ? TKHtml.escape(value) : fallbackEscapeHtml(value)
    ));
    const getDisplayedProducts = helpers.getDisplayedProducts || (() => []);
    const normalizeAccountName = helpers.normalizeAccountName || (value => String(value || '').trim());
    const uniqueAccounts = helpers.uniqueAccounts || (values => [...new Set(values.map(normalizeAccountName).filter(Boolean))]);
    const toAccountSlot = helpers.toAccountSlot || (value => String(value || '').trim() || '__unassigned__');
    const toast = ui.toast || (() => {});

    function getProductExportAccountOptions() {
      const products = getDisplayedProducts({ activeAccount: '__all__' });
      const accounts = uniqueAccounts([
        ...(state.accounts || []),
        ...products.map(product => product?.accountName)
      ]);
      const options = accounts.map(account => ({
        key: account,
        label: account,
        count: products.filter(product => normalizeAccountName(product?.accountName) === account).length
      }));
      const unassignedCount = products.filter(product => !normalizeAccountName(product?.accountName)).length;
      if (unassignedCount > 0) {
        options.push({
          key: toAccountSlot(''),
          label: '未关联',
          count: unassignedCount
        });
      }
      return options;
    }

    function buildProductExportFilename(selectedOptions) {
      const names = (selectedOptions || []).map(option => option.label).filter(Boolean);
      const suffix = names.length === 1
        ? names[0]
        : names.length > 1
          ? `${names[0]}等${names.length}个账号`
          : '空';
      return `商品数据导出_${suffix}_${todayStr()}.csv`;
    }

    function promptProductExportAccounts() {
      return new Promise(resolve => {
        const options = getProductExportAccountOptions();
        const modal = document.querySelector('#pl-export-modal');
        const list = document.querySelector('#pl-export-options');
        const allCheckbox = document.querySelector('#pl-export-all');
        const cancelBtn = document.querySelector('#pl-export-cancel');
        const confirmBtn = document.querySelector('#pl-export-confirm');

        if (!options.length || !modal || !list || !allCheckbox || !cancelBtn || !confirmBtn) {
          resolve(null);
          return;
        }

        const defaultSelectedKeys = state.activeAccount && state.activeAccount !== '__all__'
          ? [state.activeAccount]
          : options.map(option => option.key);

        list.innerHTML = options.map(option => `
          <label class="ot-export-option">
            <span class="ot-export-option-main">
              <input type="checkbox" class="pl-export-checkbox" value="${escapeHtml(option.key)}" ${defaultSelectedKeys.includes(option.key) ? 'checked' : ''}>
              <span class="ot-export-option-name">${escapeHtml(option.label)}</span>
            </span>
            <span class="ot-export-option-count">${option.count} 个商品</span>
          </label>
        `).join('');

        const checkboxes = [...list.querySelectorAll('.pl-export-checkbox')];
        const syncAllState = () => {
          allCheckbox.checked = checkboxes.length > 0 && checkboxes.every(checkbox => checkbox.checked);
        };
        syncAllState();

        function cleanup(result) {
          modal.classList.remove('show');
          allCheckbox.checked = false;
          allCheckbox.onchange = null;
          cancelBtn.onclick = null;
          confirmBtn.onclick = null;
          modal.onclick = null;
          checkboxes.forEach(checkbox => {
            checkbox.onchange = null;
          });
          resolve(result);
        }

        allCheckbox.onchange = () => {
          checkboxes.forEach(checkbox => {
            checkbox.checked = allCheckbox.checked;
          });
        };
        checkboxes.forEach(checkbox => {
          checkbox.onchange = syncAllState;
        });

        cancelBtn.onclick = () => cleanup(null);
        confirmBtn.onclick = () => {
          const selectedKeys = checkboxes.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
          if (!selectedKeys.length) {
            toast('请至少选择一个账号', 'error');
            return;
          }
          cleanup(selectedKeys);
        };
        modal.onclick = event => {
          if (event.target?.id === 'pl-export-modal') cleanup(null);
        };

        modal.classList.add('show');
        confirmBtn.focus();
      });
    }

    function buildProductExportRows(selectedSet) {
      const products = getDisplayedProducts({ activeAccount: '__all__' })
        .filter(product => selectedSet.has(toAccountSlot(product?.accountName)));
      return products.flatMap(product => {
        const defaults = getProductDefaults(product);
        const skus = getProductSkus(product);
        const base = [
          product?.accountName || '',
          product?.tkId || '',
          product?.name || '',
          defaults?.cargoType === 'special' ? '特货' : '普货'
        ];
        if (!skus.length) {
          return [[
            ...base,
            '',
            '',
            defaults?.weightG || '',
            formatSizeText(defaults),
            defaults?.estimatedShippingFee || '',
            product?.link1688 || '',
            product?.imageUrl || '',
            product?.createdAt || '',
            product?.updatedAt || ''
          ]];
        }
        return skus.map(sku => {
          const record = mergeProductSku(product, sku);
          return [
            ...base,
            sku?.skuName || '',
            sku?.skuId || '',
            record?.weightG || '',
            formatSizeText(record),
            record?.estimatedShippingFee || '',
            product?.link1688 || '',
            product?.imageUrl || '',
            product?.createdAt || '',
            product?.updatedAt || ''
          ];
        });
      });
    }

    async function exportProductsCsv() {
      const selectedKeys = await promptProductExportAccounts();
      if (!selectedKeys || !selectedKeys.length) return;
      const selectedSet = new Set(selectedKeys);
      const selectedOptions = getProductExportAccountOptions().filter(option => selectedSet.has(option.key));
      const rows = buildProductExportRows(selectedSet);
      if (!rows.length) {
        toast('当前选择下没有可导出的商品数据', 'error');
        return;
      }
      const headers = ['账号', 'TK ID', '商品名称', '货物类型', 'SKU 名称', 'SKU ID', '重量(g)', '尺寸(cm)', '单件预估海外运费(元)', '1688 链接', '图片 URL', '创建时间', '更新时间'];
      const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const filename = buildProductExportFilename(selectedOptions);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast('CSV 已开始导出', 'ok');
    }

    return {
      buildProductExportFilename,
      buildProductExportRows,
      exportProductsCsv,
      getProductExportAccountOptions,
      promptProductExportAccounts
    };
  }

  return {
    create,
    csvEscape,
    formatSizeText,
    getProductDefaults,
    getProductSkus,
    mergeProductSku,
    skuUsesProductDefaults
  };
})();
