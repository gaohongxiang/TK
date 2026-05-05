/* ============================================================
 * 商品库：弹窗与 CRUD
 * ============================================================ */
const ProductLibraryCrud = (function () {
  const formUtils = ProductLibraryFormUtils;
  const {
    buildBatchSkuDrafts,
    buildEstimatedShippingSnapshot,
    formatSizeInput,
    matchesBatchSkuName,
    parseBatchTokens,
    parseSizeInput,
    resolveProductDimensions,
    skuUsesProductDefaults
  } = formUtils;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    ));
  }

  function create({ state, helpers, ui }) {
    const { $, nowIso, getPricingContext, shippingCore } = helpers;
    const { saveProduct, deleteProduct, toast, rerender, formatError } = ui;
    let sharedDefaultsDraft = {
      weightG: '',
      sizeText: ''
    };
    let eventsBound = false;

    function getProductDefaults(product = {}) {
      return product?.defaults && typeof product.defaults === 'object'
        ? product.defaults
        : product;
    }

    function readProductDefaults() {
      const editor = readParameterEditor();
      const nextWeight = !editor.matchText && editor.weightG
        ? editor.weightG
        : sharedDefaultsDraft.weightG;
      const nextSize = !editor.matchText && editor.sizeText
        ? editor.sizeText
        : sharedDefaultsDraft.sizeText;
      return {
        cargoType: $('#pl-form')?.querySelector('[name="cargoType"]')?.value || 'general',
        weightG: nextWeight || '',
        sizeText: nextSize || ''
      };
    }

    function readParameterEditor() {
      return {
        matchText: String($('#pl-batch-match')?.value || '').trim(),
        weightG: String($('#pl-batch-weight')?.value || '').trim(),
        sizeText: String($('#pl-batch-size')?.value || '').trim()
      };
    }

    function setParameterEditor({ matchText = '', weightG = '', sizeText = '' } = {}) {
      const matchInput = $('#pl-batch-match');
      const weightInput = $('#pl-batch-weight');
      const sizeInput = $('#pl-batch-size');
      if (matchInput) matchInput.value = matchText;
      if (weightInput) weightInput.value = weightG;
      if (sizeInput) sizeInput.value = sizeText;
    }

    function buildProductDefaultsSnapshot() {
      const defaults = readProductDefaults();
      const dimensions = resolveProductDimensions(defaults);
      return {
        ...defaults,
        ...dimensions,
        ...buildEstimatedShippingSnapshot({
          shippingCore,
          pricingContext: getPricingContext(),
          product: {
            ...defaults,
            ...dimensions
          }
        })
      };
    }

    function clearValidationErrors() {
      document.querySelectorAll('#pl-form .is-invalid').forEach(element => {
        element.classList.remove('is-invalid');
      });
    }

    function markInvalidField(input) {
      if (!input) return;
      input.classList.add('is-invalid');
    }

    function markSharedDefaultsInvalid() {
      const defaults = readProductDefaults();
      const { weightG, sizeText } = defaults;
      setParameterEditor({ matchText: '', weightG, sizeText });
      markInvalidField($('#pl-batch-weight'));
      markInvalidField($('#pl-batch-size'));
    }

    function markSkuRowInvalid(index, fields = []) {
      const row = document.querySelector(`#pl-sku-list .pl-sku-edit-row[data-sku-index="${index}"]`);
      if (!row) return;
      fields.forEach(field => {
        markInvalidField(row.querySelector(`[data-sku-field="${field}"]`));
      });
    }

    function getSkuListContainer() {
      return $('#pl-sku-list');
    }

    function createEmptySku() {
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

    function generateInternalSkuId() {
      return `sku_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    }

    function formatSkuTitle(index, sku = {}) {
      const skuId = String(sku?.skuId || '').trim();
      const skuName = String(sku?.skuName || '').trim();
      if (skuName) return skuName;
      if (skuId) return skuId;
      return '未命名 SKU';
    }

    function readSkuDrafts() {
      return Array.from(document.querySelectorAll('#pl-sku-list .pl-sku-edit-row')).map(item => ({
        skuId: item.querySelector('[data-sku-field="skuId"]')?.value || '',
        skuName: item.querySelector('[data-sku-field="skuName"]')?.value || '',
        useProductDefaults: String(item.dataset.skuUseDefaults || '1') !== '0',
        weightG: item.querySelector('[data-sku-field="weightG"]')?.value || '',
        sizeText: item.querySelector('[data-sku-field="sizeText"]')?.value || ''
      }));
    }

    function clearBatchTools() {
      ['#pl-batch-axis-a', '#pl-batch-axis-b', '#pl-batch-axis-c', '#pl-batch-match', '#pl-batch-weight', '#pl-batch-size'].forEach(selector => {
        const input = $(selector);
        if (input) input.value = '';
      });
    }

    function setBatchPanelOpen(open) {
      const batchPanel = $('#pl-sku-batch-tools');
      const toggleBtn = $('#pl-open-sku-batch');
      if (!batchPanel) return;
      batchPanel.classList.toggle('show', !!open);
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        window.requestAnimationFrame?.(() => {
          $('#pl-batch-axis-a')?.focus();
        });
      }
    }

    function appendGeneratedSkus() {
      const drafts = readSkuDrafts();
      const generated = buildBatchSkuDrafts(
        $('#pl-batch-axis-a')?.value,
        $('#pl-batch-axis-b')?.value,
        $('#pl-batch-axis-c')?.value
      );
      if (!generated.length) {
        toast('请先填写至少一组规格值', 'error');
        return;
      }
      const existingNames = new Set(drafts.map(item => String(item.skuName || '').trim()).filter(Boolean));
      const appended = generated
        .filter(item => !existingNames.has(item.skuName))
        .map(item => ({
          ...createEmptySku(),
          skuName: item.skuName
        }));
      if (!appended.length) {
        toast('这些 SKU 名称已经都存在了', 'error');
        return;
      }
      renderSkuList([...drafts, ...appended]);
      clearBatchTools();
      toast(`已生成 ${appended.length} 个 SKU`, 'ok');
    }

    function syncParameterEditorToSkus() {
      const { matchText, weightG: weightValue, sizeText: sizeValue } = readParameterEditor();
      const normalizedMatch = matchText.toLowerCase();
      const hasWeight = !!weightValue;
      const hasSize = !!sizeValue;
      if (!hasWeight && !hasSize) {
        renderSkuPreviews();
        return;
      }
      const drafts = readSkuDrafts().map(item => ({ ...item }));
      if (!normalizedMatch) {
        sharedDefaultsDraft = {
          weightG: hasWeight ? weightValue : sharedDefaultsDraft.weightG,
          sizeText: hasSize ? sizeValue : sharedDefaultsDraft.sizeText
        };
        const nextDrafts = drafts.map(item => ({
          ...item,
          useProductDefaults: true
        }));
        renderSkuList(nextDrafts);
        return;
      }
      let matchedCount = 0;
      drafts.forEach(item => {
        if (!matchesBatchSkuName(item.skuName, normalizedMatch)) return;
        matchedCount += 1;
        item.useProductDefaults = false;
        if (hasWeight) item.weightG = weightValue;
        if (hasSize) item.sizeText = sizeValue;
      });
      if (!matchedCount) {
        renderSkuPreviews();
        return;
      }
      renderSkuList(drafts);
    }

    function renderSkuList(skus = []) {
      const container = getSkuListContainer();
      if (!container) return;
      const list = Array.isArray(skus) ? skus : [];
      if (!list.length) {
        container.innerHTML = '<div class="pl-sku-empty">请先添加 SKU；每个 SKU 单独维护重量、尺寸和预估运费。</div>';
        return;
      }

      container.innerHTML = `
        <div class="pl-sku-table-wrap">
          <table class="pl-sku-edit-table">
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
              ${list.map((sku, index) => `
                <tr class="pl-sku-edit-row ${skuUsesProductDefaults(sku) ? 'is-inheriting' : ''}" data-sku-index="${index}" data-sku-use-defaults="${skuUsesProductDefaults(sku) ? '1' : '0'}">
                  <td>
                    <input
                      type="text"
                      class="pl-sku-inline-input"
                      data-sku-field="skuName"
                      placeholder="例如 白 / S"
                      value="${escapeHtml(String(sku?.skuName || ''))}">
                  </td>
                  <td>
                    <input
                      type="text"
                      class="pl-sku-inline-input"
                      data-sku-field="skuId"
                      value="${escapeHtml(String(sku?.skuId || generateInternalSkuId()))}">
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      class="pl-sku-inline-input"
                      data-sku-field="weightG"
                      value="${escapeHtml(String(sku?.weightG || ''))}">
                  </td>
                  <td>
                    <input
                      type="text"
                      class="pl-sku-inline-input"
                      data-sku-field="sizeText"
                      placeholder="例如 20×15×10"
                      value="${escapeHtml(String(sku?.sizeText || formatSizeInput(sku) || ''))}">
                  </td>
                  <td>
                    <div class="pl-sku-fee-stack">
                      <span class="pl-sku-fee-value" data-sku-estimated-fee>-</span>
                      <span class="pl-sku-fee-sub" data-sku-charge-weight></span>
                      <span class="pl-sku-fee-note" data-sku-note></span>
                    </div>
                  </td>
                  <td class="pl-sku-cell-actions">
                    <button type="button" class="btn sm danger" data-sku-remove="${index}">删除</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      renderSkuPreviews();
    }

    function buildSkuDraftSnapshot(skuDraft, cargoType, defaultSnapshot) {
      const useProductDefaults = skuDraft?.useProductDefaults !== false;
      const source = useProductDefaults
        ? {
          cargoType,
          weightG: defaultSnapshot?.weightG || '',
          sizeText: defaultSnapshot?.sizeText || '',
          lengthCm: defaultSnapshot?.lengthCm || '',
          widthCm: defaultSnapshot?.widthCm || '',
          heightCm: defaultSnapshot?.heightCm || ''
        }
        : skuDraft;
      const dimensions = resolveProductDimensions(source);
      return {
        ...skuDraft,
        useProductDefaults,
        ...dimensions,
        ...buildEstimatedShippingSnapshot({
          shippingCore,
          pricingContext: getPricingContext(),
          product: {
            ...source,
            ...dimensions,
            cargoType
          }
        })
      };
    }

    function renderSkuPreviews() {
      const cargoType = $('#pl-form [name="cargoType"]')?.value || 'general';
      const defaultSnapshot = buildProductDefaultsSnapshot();
      Array.from(document.querySelectorAll('#pl-sku-list .pl-sku-edit-row')).forEach(item => {
        const weightInput = item.querySelector('[data-sku-field="weightG"]');
        const sizeInput = item.querySelector('[data-sku-field="sizeText"]');
        const draft = {
          skuId: item.querySelector('[data-sku-field="skuId"]')?.value || '',
          skuName: item.querySelector('[data-sku-field="skuName"]')?.value || '',
          useProductDefaults: String(item.dataset.skuUseDefaults || '1') !== '0',
          weightG: weightInput?.value || '',
          sizeText: sizeInput?.value || ''
        };
        item.classList.toggle('is-inheriting', draft.useProductDefaults);
        if (draft.useProductDefaults) {
          if (weightInput) {
            weightInput.value = String(defaultSnapshot.weightG || '').trim();
          }
          if (sizeInput) {
            sizeInput.value = String(defaultSnapshot.sizeText || '').trim();
          }
          draft.weightG = weightInput?.value || '';
          draft.sizeText = sizeInput?.value || '';
        }
        const snapshot = buildSkuDraftSnapshot(draft, cargoType, defaultSnapshot);
        const feeEl = item.querySelector('[data-sku-estimated-fee]');
        const chargeEl = item.querySelector('[data-sku-charge-weight]');
        const noteEl = item.querySelector('[data-sku-note]');
        if (feeEl) feeEl.textContent = snapshot.estimatedShippingFee ? `¥ ${snapshot.estimatedShippingFee}` : '-';
        if (chargeEl) chargeEl.textContent = snapshot.chargeWeightKg ? `计费重 ${snapshot.chargeWeightKg} kg` : '';
        if (noteEl) {
          if (!draft.useProductDefaults && String(draft.sizeText || '').trim() && !snapshot.isComplete) {
            noteEl.textContent = '尺寸请按 长×宽×高 填写';
          } else {
            noteEl.textContent = snapshot.shippingNote || '';
          }
        }
      });
    }

    function normalizeSkuDrafts() {
      clearValidationErrors();
      const cargoType = $('#pl-form [name="cargoType"]')?.value || 'general';
      const defaultSnapshot = buildProductDefaultsSnapshot();
      const seen = new Set();
      const normalized = [];
      const drafts = readSkuDrafts();
      for (const [index, draft] of drafts.entries()) {
        const skuName = String(draft.skuName || '').trim();
        const useProductDefaults = draft.useProductDefaults !== false;
        const weightG = String(draft.weightG || '').trim();
        const sizeText = String(draft.sizeText || '').trim();
        const hasAnyValue = !!(skuName || weightG || sizeText);
        if (!hasAnyValue) continue;
        if (!skuName) {
          markSkuRowInvalid(index, ['skuName']);
          return { error: '请输入 SKU 名称', skus: [] };
        }
        const skuId = String(draft.skuId || '').trim() || generateInternalSkuId();
        if (seen.has(skuId)) {
          markSkuRowInvalid(index, ['skuId']);
          return { error: 'SKU 内部标识重复了，请重新打开弹窗后再试', skus: [] };
        }
        seen.add(skuId);
        if (useProductDefaults && (!String(defaultSnapshot.weightG || '').trim() || !defaultSnapshot.isComplete)) {
          markSharedDefaultsInvalid();
          return { error: `SKU「${skuName}」缺少共用重量或尺寸，无法保存`, skus: [] };
        }
        if (!useProductDefaults) {
          const invalidFields = [];
          if (!weightG) invalidFields.push('weightG');
          if (!sizeText) invalidFields.push('sizeText');
          if (invalidFields.length) {
            markSkuRowInvalid(index, invalidFields);
            return { error: `请补全 SKU「${skuName}」的重量和尺寸`, skus: [] };
          }
        }
        const snapshot = buildSkuDraftSnapshot({ skuId, skuName, useProductDefaults, weightG, sizeText }, cargoType, defaultSnapshot);
        if (!useProductDefaults && sizeText && !snapshot.isComplete) {
          markSkuRowInvalid(index, ['sizeText']);
          return { error: `SKU「${skuName}」尺寸请按 长×宽×高 填写`, skus: [] };
        }
        normalized.push({
          skuId,
          skuName,
          useProductDefaults,
          weightG: useProductDefaults ? '' : snapshot.weightG,
          sizeText: useProductDefaults ? '' : snapshot.sizeText,
          lengthCm: useProductDefaults ? '' : snapshot.lengthCm,
          widthCm: useProductDefaults ? '' : snapshot.widthCm,
          heightCm: useProductDefaults ? '' : snapshot.heightCm,
          estimatedShippingFee: useProductDefaults ? '' : snapshot.estimatedShippingFee,
          chargeWeightKg: useProductDefaults ? '' : snapshot.chargeWeightKg,
          shippingNote: useProductDefaults ? '' : snapshot.shippingNote
        });
      }
      return { skus: normalized, error: '' };
    }

    function fillForm(product = null) {
      const form = $('#pl-form');
      if (!form) return;
      form.reset();
      if (!product) {
        sharedDefaultsDraft = { weightG: '', sizeText: '' };
        setParameterEditor(sharedDefaultsDraft);
        const accountSelect = form.querySelector('[name="accountName"]');
        if (accountSelect) {
          if (state.activeAccount && state.activeAccount !== '__all__') {
            accountSelect.value = state.activeAccount;
          } else if (accountSelect.options.length > 1) {
            accountSelect.value = accountSelect.options[1].value;
          }
        }
        renderSkuList([createEmptySku()]);
        renderShippingPreview();
        return;
      }
      Object.entries(product).forEach(([key, value]) => {
        if (key === 'skus' || key === 'defaults') return;
        const input = form.querySelector(`[name="${key}"]`);
        if (input) input.value = value ?? '';
      });
      const defaults = getProductDefaults(product);
      const cargoTypeInput = form.querySelector('[name="cargoType"]');
      if (cargoTypeInput) cargoTypeInput.value = defaults?.cargoType || 'general';
      sharedDefaultsDraft = {
        weightG: defaults?.weightG ?? '',
        sizeText: formatSizeInput(defaults)
      };
      setParameterEditor(sharedDefaultsDraft);
      renderSkuList((product?.skus || []).length ? product.skus : [createEmptySku()]);
      renderShippingPreview();
    }

    function renderShippingPreview() {
      renderSkuPreviews();
    }

    function openModal(tkId = '') {
      const modal = $('#pl-modal');
      const idInput = $('#pl-form [name="tkId"]');
      if (!modal) return;
      state.editingTkId = tkId || '';
      const current = tkId ? (state.products || []).find(item => item.tkId === tkId) : null;
      $('#pl-modal-title').textContent = current ? '编辑商品' : '新增商品';
      if (idInput) idInput.readOnly = !!current;
      setBatchPanelOpen(false);
      clearBatchTools();
      fillForm(current || null);
      renderShippingPreview();
      modal.classList.add('show');
    }

    function closeModal() {
      const modal = $('#pl-modal');
      if (modal) modal.classList.remove('show');
      state.editingTkId = '';
    }

    async function submitForm(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = Object.fromEntries(new FormData(form).entries());
      const { skus, error: skuError } = normalizeSkuDrafts();
      const defaultSnapshot = buildProductDefaultsSnapshot();
      payload.tkId = String(payload.tkId || '').trim();
      payload.accountName = String(payload.accountName || '').trim();
      payload.name = String(payload.name || '').trim();
      if (skuError) {
        toast(skuError, 'error');
        return;
      }
      if (!skus.length) {
        toast('请至少添加一个 SKU', 'error');
        return;
      }
      if (!payload.tkId) {
        toast('请输入商品 TK ID', 'error');
        return;
      }
      if (!payload.accountName) {
        toast('请选择商品所属账号', 'error');
        return;
      }
      const duplicate = (state.products || []).find(item => item.tkId === payload.tkId && item.tkId !== state.editingTkId);
      if (duplicate) {
        toast('该 TK ID 已存在', 'error');
        return;
      }
      const current = state.editingTkId ? (state.products || []).find(item => item.tkId === state.editingTkId) : null;
      try {
        const saved = await saveProduct({
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
          createdAt: current?.createdAt || nowIso(),
          updatedAt: nowIso()
        });
        const nextList = (state.products || []).filter(item => item.tkId !== saved.tkId);
        nextList.push(saved);
        state.products = nextList;
        closeModal();
        rerender();
        toast('商品已保存', 'ok');
      } catch (error) {
        toast(typeof formatError === 'function' ? formatError(error, '商品保存失败') : (error.message || '商品保存失败'), 'error');
      }
    }

    async function removeProduct(tkId) {
      if (!window.confirm('确定删除这个商品？')) return;
      try {
        await deleteProduct(tkId);
        state.products = (state.products || []).filter(item => item.tkId !== tkId);
        rerender();
        toast('商品已删除', 'ok');
      } catch (error) {
        toast(typeof formatError === 'function' ? formatError(error, '商品删除失败') : (error.message || '商品删除失败'), 'error');
      }
    }

    function bindEvents() {
      if (eventsBound) return;
      eventsBound = true;
      const form = $('#pl-form');
      const cancelBtn = $('#pl-cancel');
      const modal = $('#pl-modal');
      const addSkuBtn = $('#pl-add-sku');
      if (!form) return;
      form.addEventListener('submit', submitForm);
      if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
      if (modal) {
        modal.addEventListener('click', event => {
          if (event.target.id === 'pl-modal') closeModal();
        });
      }
      ['cargoType'].forEach(name => {
        const input = form.querySelector(`[name="${name}"]`);
        if (!input) return;
        input.addEventListener('input', renderShippingPreview);
        input.addEventListener('change', renderShippingPreview);
      });
      addSkuBtn?.addEventListener('click', () => {
        const drafts = readSkuDrafts();
        drafts.push(createEmptySku());
        renderSkuList(drafts);
      });
      form.addEventListener('input', event => {
        if (event.target.matches('#pl-batch-match, #pl-batch-weight, #pl-batch-size, [data-sku-field]')) {
          event.target.classList.remove('is-invalid');
        }
        if (event.target.matches('#pl-batch-match, #pl-batch-weight, #pl-batch-size')) {
          syncParameterEditorToSkus();
          return;
        }
        if (event.target.matches('[data-sku-field="weightG"], [data-sku-field="sizeText"]')) {
          const row = event.target.closest('.pl-sku-edit-row');
          if (row && row.dataset.skuUseDefaults !== '0') row.dataset.skuUseDefaults = '0';
        }
        if (event.target.closest('#pl-sku-list')) renderSkuPreviews();
      });
      form.addEventListener('change', event => {
        if (event.target.closest('#pl-sku-list')) renderSkuPreviews();
      });
      form.addEventListener('click', event => {
        const batchToggle = event.target.closest('#pl-open-sku-batch');
        if (batchToggle) {
          event.preventDefault();
          const isOpen = $('#pl-sku-batch-tools')?.classList.contains('show');
          setBatchPanelOpen(!isOpen);
          return;
        }
        const generateBatch = event.target.closest('#pl-generate-skus');
        if (generateBatch) {
          event.preventDefault();
          appendGeneratedSkus();
          return;
        }
        const removeBtn = event.target.closest('[data-sku-remove]');
        if (!removeBtn) return;
        const index = Number(removeBtn.dataset.skuRemove || -1);
        const drafts = readSkuDrafts().filter((_, currentIndex) => currentIndex !== index);
        renderSkuList(drafts);
      });
    }

    return {
      openModal,
      closeModal,
      bindEvents,
      deleteProduct: removeProduct
    };
  }

  return {
    parseSizeInput,
    parseBatchTokens,
    buildBatchSkuDrafts,
    matchesBatchSkuName,
    buildEstimatedShippingSnapshot,
    create
  };
})();
