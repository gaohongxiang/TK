/* ============================================================
 * 订单跟踪器：导出
 * ============================================================ */
const OrderTrackerExport = (function () {
  function create({ state, constants, helpers, ui }) {
    const { UNASSIGNED_ACCOUNT_SLOT } = constants;
    const {
      normalizeAccountName,
      uniqueAccounts,
      toAccountSlot,
      todayStr,
      computeWarning,
      escapeHtml
    } = helpers;
    const { toast } = ui;

    function csvEscape(value) {
      const text = String(value ?? '');
      return `"${text.replace(/"/g, '""')}"`;
    }

    function getExportAccountOptions() {
      const accounts = uniqueAccounts([
        ...(state.accounts || []),
        ...(state.orders || []).map(order => order['账号'])
      ]);
      const options = accounts.map(account => ({
        key: account,
        label: account,
        count: state.orders.filter(order => normalizeAccountName(order['账号']) === account).length
      }));
      const unassignedCount = state.orders.filter(order => !normalizeAccountName(order['账号'])).length;
      if (unassignedCount > 0) {
        options.push({
          key: UNASSIGNED_ACCOUNT_SLOT,
          label: '未关联',
          count: unassignedCount
        });
      }
      return options;
    }

    function buildExportFilename(selectedOptions) {
      const names = (selectedOptions || []).map(option => option.label).filter(Boolean);
      const suffix = names.length === 1
        ? names[0]
        : names.length > 1
          ? `${names[0]}等${names.length}个账号`
          : '空';
      return `订单数据导出_${suffix}_${todayStr()}.csv`;
    }

    function promptExportAccounts() {
      return new Promise(resolve => {
        const options = getExportAccountOptions();
        const modal = document.querySelector('#ot-export-modal');
        const list = document.querySelector('#ot-export-options');
        const allCheckbox = document.querySelector('#ot-export-all');
        const cancelBtn = document.querySelector('#ot-export-cancel');
        const confirmBtn = document.querySelector('#ot-export-confirm');

        if (!options.length) {
          resolve(null);
          return;
        }

        const defaultSelectedKeys = state.activeAccount && state.activeAccount !== '__all__'
          ? [state.activeAccount]
          : options.map(option => option.key);

        list.innerHTML = options.map(option => `
          <label class="ot-export-option">
            <span class="ot-export-option-main">
              <input type="checkbox" class="ot-export-checkbox" value="${escapeHtml(option.key)}" ${defaultSelectedKeys.includes(option.key) ? 'checked' : ''}>
              <span class="ot-export-option-name">${escapeHtml(option.label)}</span>
            </span>
            <span class="ot-export-option-count">${option.count} 条</span>
          </label>
        `).join('');

        const checkboxes = [...list.querySelectorAll('.ot-export-checkbox')];
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
        modal.onclick = e => {
          if (e.target.id === 'ot-export-modal') cleanup(null);
        };

        modal.classList.add('show');
        confirmBtn.focus();
      });
    }

    async function exportOrdersCsv() {
      if (!state.orders.length) {
        toast('当前没有可导出的订单数据', 'error');
        return;
      }
      const selectedKeys = await promptExportAccounts();
      if (!selectedKeys || !selectedKeys.length) return;

      const selectedSet = new Set(selectedKeys);
      const options = getExportAccountOptions();
      const selectedOptions = options.filter(option => selectedSet.has(option.key));
      const rowsSource = state.orders.filter(order => {
        const slot = toAccountSlot(order['账号']);
        return selectedSet.has(slot);
      });
      if (!rowsSource.length) {
        toast('当前选择下没有可导出的订单数据', 'error');
        return;
      }

      const headers = ['账号', '下单时间', '采购日期', '最晚到仓时间', '订单预警', '订单号', '产品名称', '数量', '采购价格', '重量', '尺寸', '订单状态', '快递公司', '快递单号'];
      const rows = rowsSource.map(order => {
        const warning = computeWarning(order).text;
        return [
          order['账号'] || '',
          order['下单时间'] || '',
          order['采购日期'] || '',
          order['最晚到仓时间'] || '',
          warning,
          order['订单号'] || '',
          order['产品名称'] || '',
          order['数量'] || '',
          order['采购价格'] || '',
          order['重量'] || '',
          order['尺寸'] || '',
          order['订单状态'] || '',
          order['快递公司'] || '',
          order['快递单号'] || ''
        ];
      });

      const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const filename = buildExportFilename(selectedOptions);
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
      exportOrdersCsv
    };
  }

  return {
    create
  };
})();
