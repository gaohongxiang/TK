/* ============================================================
 * 订单跟踪器：弹窗与 CRUD
 * ============================================================ */
const OrderTrackerCrud = (function () {
  function create({ state, constants, helpers, ui }) {
    const { ORDER_STATUS_OPTIONS } = constants;
    const {
      $,
      uid,
      nowIso,
      todayStr,
      addDays,
      computeWarning,
      getPricingExchangeRate,
      computeOrderEstimatedProfit,
      normalizeOrderRecord,
      escapeHtml,
      normalizeStatusValue,
      detectCourierCompany,
      maybeAutoDetectCourierFromForm,
      getOrderFormCourierFields,
      showDatePicker
    } = helpers;
    const getNowIso = typeof nowIso === 'function'
      ? nowIso
      : () => new Date().toISOString();
    const {
      getUniqueAccounts,
      promptAddAccount,
      addAccount,
      markAccountsDirty,
      markOrderAccountsDirty,
      commitLocalOrders,
      toast
    } = ui;

    function updateModalAccountSelect(selectedAcc) {
      const select = $('#ot-acc-select');
      if (!select) return;
      const accounts = getUniqueAccounts();
      select.innerHTML = accounts.map(account => `<option value="${escapeHtml(account)}">${escapeHtml(account)}</option>`).join('')
        + '<option value="__ADD__">+ 添加新账号...</option>';
      if (selectedAcc && accounts.includes(selectedAcc)) select.value = selectedAcc;
      else if (accounts.length) select.value = accounts[0];
    }

    function ensureOrderStatusOption(selectedStatus = '') {
      const select = $('#ot-form [name="订单状态"]');
      if (!select) return;
      const currentValue = normalizeStatusValue(selectedStatus);
      const options = ['', ...ORDER_STATUS_OPTIONS];
      select.innerHTML = options.map(value => {
        const label = value || '- 请选择 -';
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
      }).join('');
      if (currentValue && !options.includes(currentValue)) {
        const option = document.createElement('option');
        option.value = currentValue;
        option.textContent = currentValue;
        select.appendChild(option);
      }
      select.value = currentValue;
    }

    function recomputeAuto() {
      const form = $('#ot-form');
      if (!form) return;
      const ordered = form.querySelector('[name="下单时间"]')?.value || '';
      const warehouseField = form.querySelector('[name="最晚到仓时间"]');
      const warningField = form.querySelector('[name="订单预警"]');
      const estimatedProfitField = form.querySelector('[name="预估利润"]');
      if (warehouseField) warehouseField.value = ordered ? addDays(ordered, 6) : '';
      if (warningField) {
        const temp = Object.fromEntries(new FormData(form).entries());
        warningField.value = computeWarning(temp).text;
      }
      if (estimatedProfitField) {
        estimatedProfitField.value = computeEstimatedProfitFromForm(form);
      }
    }

    function formatMoneyValue(value) {
      if (!Number.isFinite(value)) return '';
      return value.toFixed(2).replace(/\.?0+$/, '');
    }

    function parseMoneyValue(value) {
      const raw = String(value ?? '').replace(/,/g, '').trim();
      if (!raw) return null;
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function resolveExchangeRate() {
      const sharedRate = typeof getPricingExchangeRate === 'function'
        ? parseMoneyValue(getPricingExchangeRate())
        : null;
      return sharedRate !== null && sharedRate > 0 ? sharedRate : null;
    }

    function computeEstimatedProfitValue({ salePrice = '', purchasePrice = '', estimatedShippingFee = '' } = {}) {
      const exchangeRate = resolveExchangeRate();
      const sharedProfit = typeof computeOrderEstimatedProfit === 'function'
        ? computeOrderEstimatedProfit({
          '售价': salePrice,
          '采购价格': purchasePrice,
          '预估运费': estimatedShippingFee
        }, exchangeRate)
        : null;
      if (sharedProfit !== null) return formatMoneyValue(sharedProfit);

      const sale = parseMoneyValue(salePrice);
      const purchase = parseMoneyValue(purchasePrice);
      const shipping = parseMoneyValue(estimatedShippingFee);
      if (exchangeRate === null || sale === null || purchase === null || shipping === null) return '';
      return formatMoneyValue((sale / exchangeRate) - (purchase + shipping));
    }

    function computeEstimatedProfitFromForm(form) {
      if (!form) return '';
      return computeEstimatedProfitValue({
        salePrice: form.querySelector('[name="售价"]')?.value || '',
        purchasePrice: form.querySelector('[name="采购价格"]')?.value || '',
        estimatedShippingFee: form.querySelector('[name="预估运费"]')?.value || ''
      });
    }

    function maybeAutoSetInTransitFromTracking() {
      const form = $('#ot-form');
      if (!form || state.editingId) return '';
      const trackingField = form.querySelector('[name="快递单号"]');
      const statusField = form.querySelector('[name="订单状态"]');
      if (!trackingField || !statusField) return '';

      const tracking = String(trackingField.value || '').trim();
      const currentStatus = normalizeStatusValue(statusField.value);
      const autoStatus = normalizeStatusValue(statusField.dataset.autoTrackingStatus || '');

      if (!tracking) {
        if (autoStatus && currentStatus === autoStatus) {
          statusField.value = '';
          statusField.dataset.autoTrackingStatus = '';
          recomputeAuto();
        }
        return '';
      }

      const canAutoPromote = !currentStatus
        || currentStatus === '未采购'
        || currentStatus === '已采购'
        || currentStatus === autoStatus;

      if (!canAutoPromote) return currentStatus;

      statusField.value = '在途';
      statusField.dataset.autoTrackingStatus = '在途';
      recomputeAuto();
      return '在途';
    }

    function openModal(editId = null) {
      const form = $('#ot-form');
      const modal = $('#ot-modal');
      if (!form || !modal) return;
      form.reset();
      state.editingId = editId;
      const orderStatusField = form.querySelector('[name="订单状态"]');
      if (orderStatusField) orderStatusField.dataset.autoTrackingStatus = '';

      if (editId) {
        const found = (state.orders || []).find(order => order.id === editId);
        if (!found) return;
        const order = normalizeOrderRecord(found);
        $('#ot-modal-title').textContent = '编辑订单';
        updateModalAccountSelect(order['账号'] || '');
        ensureOrderStatusOption(order['订单状态']);
        Object.entries(order).forEach(([key, value]) => {
          if (key === '账号') return;
          const input = form.querySelector(`[name="${key}"]`);
          if (input) input.value = value ?? '';
        });
      } else {
        $('#ot-modal-title').textContent = '新增订单';
        const orderDate = form.querySelector('[name="下单时间"]');
        const purchaseDate = form.querySelector('[name="采购日期"]');
        if (orderDate) orderDate.value = todayStr();
        if (purchaseDate) purchaseDate.value = todayStr();

        let defaultAccount = null;
        if (state.activeAccount && state.activeAccount !== '__all__') {
          defaultAccount = state.activeAccount;
        } else if ((state.accounts || []).length) {
          defaultAccount = state.accounts[0];
        }
        updateModalAccountSelect(defaultAccount);
        ensureOrderStatusOption('');
      }

      maybeAutoDetectCourierFromForm();
      maybeAutoSetInTransitFromTracking();
      recomputeAuto();
      modal.classList.add('show');
    }

    function closeModal() {
      const modal = $('#ot-modal');
      if (modal) modal.classList.remove('show');
      state.editingId = null;
    }

    async function submitForm(event) {
      event.preventDefault();
      const payload = normalizeOrderRecord(Object.fromEntries(new FormData(event.target).entries()));
      if (payload['账号'] === '__ADD__') {
        toast('请选择有效的账号', 'error');
        return;
      }
      if (!payload['快递公司'] && payload['快递单号']) {
        payload['快递公司'] = detectCourierCompany(payload['快递单号']);
      }
      if (!state.editingId && payload['快递单号']) {
        const currentStatus = normalizeStatusValue(payload['订单状态']);
        if (!currentStatus || currentStatus === '未采购' || currentStatus === '已采购') {
          payload['订单状态'] = '在途';
        }
      }
      payload['预估利润'] = computeEstimatedProfitValue({
        salePrice: payload['售价'],
        purchasePrice: payload['采购价格'],
        estimatedShippingFee: payload['预估运费']
      });
      payload['最晚到仓时间'] = payload['下单时间'] ? addDays(payload['下单时间'], 6) : '';
      payload['订单预警'] = computeWarning(payload).text;

      if (payload['账号'] && addAccount(payload['账号'])) markAccountsDirty();

      if (state.editingId) {
        const index = (state.orders || []).findIndex(order => order.id === state.editingId);
        if (index >= 0) {
          const previous = state.orders[index];
          state.orders[index] = normalizeOrderRecord({ ...previous, ...payload, updatedAt: getNowIso() });
          markOrderAccountsDirty([previous['账号'], state.orders[index]['账号']]);
        }
      } else {
        const createdAt = getNowIso();
        const created = normalizeOrderRecord({ id: uid(), ...payload, createdAt, updatedAt: createdAt });
        state.orders.unshift(created);
        markOrderAccountsDirty([created['账号']]);
      }

      closeModal();
      await commitLocalOrders('已保存到本地，等待同步…');
      toast('已保存到本地', 'ok');
    }

    async function deleteOrder(id) {
      if (!window.confirm('确定删除这条订单？删除后需要手动从 Gist 历史恢复。')) return;
      const target = (state.orders || []).find(order => order.id === id);
      state.orders = (state.orders || []).filter(order => order.id !== id);
      markOrderAccountsDirty([target?.['账号']]);
      await commitLocalOrders('已删除，本地已更新，等待同步…');
      toast('已删除', 'ok');
    }

    function bindEvents() {
      const form = $('#ot-form');
      const cancelBtn = $('#ot-cancel');
      const modal = $('#ot-modal');
      if (!form) return;

      if (cancelBtn) cancelBtn.onclick = closeModal;
      form.onsubmit = submitForm;

      const orderDate = form.querySelector('[name="下单时间"]');
      const orderStatus = form.querySelector('[name="订单状态"]');
      const purchasePrice = form.querySelector('[name="采购价格"]');
      const salePrice = form.querySelector('[name="售价"]');
      const estimatedShippingFee = form.querySelector('[name="预估运费"]');
      if (orderDate) orderDate.addEventListener('change', recomputeAuto);
      [purchasePrice, salePrice, estimatedShippingFee].forEach(field => {
        if (!field) return;
        field.addEventListener('input', recomputeAuto);
        field.addEventListener('change', recomputeAuto);
      });
      if (orderStatus) {
        orderStatus.addEventListener('change', () => {
          const autoStatus = normalizeStatusValue(orderStatus.dataset.autoTrackingStatus || '');
          if (autoStatus && normalizeStatusValue(orderStatus.value) !== autoStatus) {
            orderStatus.dataset.autoTrackingStatus = '';
          }
          recomputeAuto();
        });
      }

      const courierFields = getOrderFormCourierFields();
      if (courierFields.tracking) {
        courierFields.tracking.addEventListener('input', () => {
          maybeAutoDetectCourierFromForm();
          maybeAutoSetInTransitFromTracking();
        });
        courierFields.tracking.addEventListener('blur', () => {
          maybeAutoDetectCourierFromForm();
          maybeAutoSetInTransitFromTracking();
        });
        courierFields.tracking.addEventListener('change', () => {
          maybeAutoDetectCourierFromForm();
          maybeAutoSetInTransitFromTracking();
        });
      }

      if (courierFields.company) {
        courierFields.company.addEventListener('change', () => {
          if (courierFields.company.value !== (courierFields.company.dataset.autoDetectedCourier || '')) {
            courierFields.company.dataset.autoDetectedCourier = '';
          }
        });
      }

      form.querySelectorAll('input[type="date"]').forEach(input => {
        if (input.readOnly) return;
        input.addEventListener('click', () => showDatePicker(input));
        input.addEventListener('focus', () => showDatePicker(input));
      });

      if (modal) {
        modal.addEventListener('click', e => {
          if (e.target.id === 'ot-modal') closeModal();
        });
      }

      const accountSelect = $('#ot-acc-select');
      if (!accountSelect) return;
      let prevAccValue = '';
      accountSelect.addEventListener('focus', () => {
        prevAccValue = accountSelect.value;
      });
      accountSelect.addEventListener('change', async () => {
        if (accountSelect.value === '__ADD__') {
          const newName = await promptAddAccount();
          if (newName) {
            if (addAccount(newName)) markAccountsDirty();
            updateModalAccountSelect(newName);
          } else {
            accountSelect.value = prevAccValue;
          }
        } else {
          prevAccValue = accountSelect.value;
        }
      });
    }

    return {
      openModal,
      closeModal,
      deleteOrder,
      bindEvents
    };
  }

  return {
    create
  };
})();
