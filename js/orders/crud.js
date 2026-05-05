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
      getPricingContext,
      getPricingExchangeRate,
      computeOrderCreatorCommission,
      computeOrderEstimatedProfit,
      isOrderRefunded,
      normalizeOrderRecord,
      escapeHtml,
      normalizeAccountName,
      normalizeStatusValue,
      detectCourierCompany,
      maybeAutoDetectCourierFromForm,
      getOrderFormCourierFields,
      showDatePicker,
      shippingCore
    } = helpers;
    const getNowIso = typeof nowIso === 'function'
      ? nowIso
      : () => new Date().toISOString();
    const isRefundedOrder = typeof isOrderRefunded === 'function'
      ? isOrderRefunded
      : order => {
        const raw = String(order?.['是否退款'] ?? order?.isRefunded ?? '').trim().toLowerCase();
        return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
      };
    const {
      getUniqueAccounts,
      promptAddAccount,
      addAccount,
      markAccountsDirty,
      markOrderAccountsDirty,
      getProductByTkId,
      getProductsForAccount,
      loadProductsForModal,
      commitLocalOrders,
      toast
    } = ui;
    let productSelectApi = null;
    let skuSelectApi = null;
    let itemDraftCache = [];
    const formUtils = OrderTrackerFormUtils;
    const {
      buildOrderItemsSummary,
      buildProductLabel,
      buildSkuLabel,
      formatMoneyValue,
      formatNumericValue,
      formatProductSize,
      getProductDefaults,
      getProductSkus,
      parseMoneyValue,
      parseSizeText,
      resolveProductSnapshotSource
    } = formUtils;
    const createOrderItemDraft = seed => formUtils.createOrderItemDraft(seed, { uid });
    const getOrderItemsFromOrder = order => formUtils.getOrderItemsFromOrder(order, { uid });

    function updateModalAccountSelect(selectedAcc) {
      const select = $('#ot-acc-select');
      if (!select) return;
      const accounts = getUniqueAccounts();
      select.innerHTML = accounts.map(account => `<option value="${escapeHtml(account)}">${escapeHtml(account)}</option>`).join('')
        + '<option value="__ADD__">+ 添加新账号...</option>';
      if (selectedAcc && accounts.includes(selectedAcc)) select.value = selectedAcc;
      else if (accounts.length) select.value = accounts[0];
    }

    function getCourierOptions() {
      return [
        '',
        '韵达快递',
        '中通快递',
        '圆通快递',
        '申通快递',
        '极兔快递',
        '顺丰快递',
        '邮政快递',
        '景光物流',
        '安能物流'
      ];
    }

    function buildCourierSelectOptionsMarkup(selectedValue = '') {
      const selected = String(selectedValue || '').trim();
      return getCourierOptions().map(value => {
        const normalized = String(value || '').trim();
        const label = normalized
          ? (normalized === '邮政快递' ? '邮政 / EMS' : normalized)
          : '- 请选择 -';
        return `<option value="${escapeHtml(normalized)}"${normalized === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
      }).join('');
    }

    function ensureSearchSelects() {
      if (productSelectApi && skuSelectApi) return;
      const searchSelect = typeof TKSearchSelect !== 'undefined' ? TKSearchSelect : null;
      if (!searchSelect) return;
      if (!productSelectApi) {
        productSelectApi = searchSelect.create($('#ot-product-combobox'), {
          placeholder: '- 不关联商品 -',
          searchPlaceholder: '搜索商品ID / 名称',
          onChange(nextValue) {
            updateSkuSelect(String(nextValue || '').trim(), '', { preserveSnapshot: false });
          }
        });
      }
      if (!skuSelectApi) {
        skuSelectApi = searchSelect.create($('#ot-sku-combobox'), {
          placeholder: '- 先选择商品 -',
          searchPlaceholder: '搜索SKU ID / 名称',
          onChange(nextValue) {
            const selectedProduct = productSelectApi ? productSelectApi.getValue() : String($('#ot-product-select')?.value || '').trim();
            const relatedProduct = selectedProduct && typeof getProductByTkId === 'function'
              ? getProductByTkId(selectedProduct)
              : null;
            const relatedSkus = getProductSkus(relatedProduct);
            const selectedSkuId = String(nextValue || '').trim();
            const matchedSku = selectedSkuId
              ? relatedSkus.find(sku => String(sku?.skuId || '').trim() === selectedSkuId)
              : null;
            if (matchedSku) applyOrderSnapshot({ product: relatedProduct, sku: matchedSku });
            else if (relatedProduct && !relatedSkus.length) applyOrderSnapshot({ product: relatedProduct });
            else if (relatedProduct) applyOrderSnapshot({ product: relatedProduct, clearSpec: true });
            const skuNameField = $('#ot-sku-name');
            if (skuNameField) skuNameField.value = matchedSku ? String(matchedSku?.skuName || '').trim() : '';
          }
        });
      }
    }

    function updateProductSelect(accountName = '', selectedTkId = '') {
      ensureSearchSelects();
      const select = $('#ot-product-select');
      if (!select) return { selectedTkId: '', products: [] };
      const normalizedAccount = normalizeAccountName(accountName);
      const products = normalizedAccount && typeof getProductsForAccount === 'function'
        ? getProductsForAccount(normalizedAccount)
        : [];
      const normalizedSelected = String(selectedTkId || '').trim();
      const hasMatchedSelected = normalizedSelected && products.some(product => String(product?.tkId || '').trim() === normalizedSelected);

      if (!normalizedAccount) {
        select.value = '';
        if (productSelectApi) {
          productSelectApi.setOptions([]);
          productSelectApi.setValue('', { silent: true });
          productSelectApi.setDisabled(true);
        }
        return { selectedTkId: '', products: [] };
      }
      const options = [{ value: '', label: '- 不关联商品 -', searchText: '' }];
      products.forEach(product => {
        const tkId = String(product?.tkId || '').trim();
        if (!tkId) return;
        options.push({
          value: tkId,
          label: buildProductLabel(product),
          searchText: [
            product?.tkId,
            product?.name,
            ...getProductSkus(product).flatMap(sku => [sku?.skuId, sku?.skuName])
          ].join(' ')
        });
      });
      if (normalizedSelected && !hasMatchedSelected) {
        options.push({
          value: normalizedSelected,
          label: `${normalizedSelected}（已不存在）`,
          searchText: normalizedSelected
        });
      }
      if (productSelectApi) {
        productSelectApi.setOptions(options);
        productSelectApi.setDisabled(false);
        productSelectApi.setValue(normalizedSelected, { silent: true });
      } else {
        select.value = normalizedSelected;
      }
      return {
        selectedTkId: normalizedSelected,
        products
      };
    }

    function applyOrderSnapshot({ product = null, sku = null, clearSpec = false } = {}) {
      const form = $('#ot-form');
      if (!form) return;
      const productNameField = form.querySelector('[name="产品名称"]');
      const weightField = form.querySelector('[name="重量"]');
      const sizeField = form.querySelector('[name="尺寸"]');
      const estimatedShippingFeeField = form.querySelector('[name="预估运费"]');
      const skuNameField = form.querySelector('[name="商品SKU名称"]');

      if (productNameField) {
        if (product) productNameField.value = String(product?.name || '').trim();
      }
      if (skuNameField) skuNameField.value = sku ? String(sku?.skuName || '').trim() : '';

      if (clearSpec) {
        if (!product && productNameField) productNameField.value = '';
        if (weightField) weightField.value = '';
        if (sizeField) sizeField.value = '';
        if (estimatedShippingFeeField) {
          estimatedShippingFeeField.value = '';
          estimatedShippingFeeField.dataset.autoManaged = '';
        }
        resetSpecAutoState(form);
        recomputeAuto();
        return;
      }

      const source = resolveProductSnapshotSource(product, sku);
      if (!source) return;
      const quantity = getOrderQuantityValue(form);
      const unitWeight = parseMoneyValue(source?.weightG);
      const sizeTemplate = formatProductSize(source);
      if (weightField) {
        weightField.dataset.unitWeight = unitWeight !== null ? String(unitWeight) : '';
        weightField.dataset.autoManaged = unitWeight !== null ? '1' : '';
        weightField.value = unitWeight !== null ? formatNumericValue(unitWeight * quantity) : '';
      }
      if (sizeField) {
        sizeField.dataset.autoTemplate = sizeTemplate;
        sizeField.dataset.autoManaged = sizeTemplate ? '1' : '';
        sizeField.placeholder = '例如 20×15×10';
        sizeField.value = sizeTemplate;
      }
      if (estimatedShippingFeeField) {
        estimatedShippingFeeField.value = String(source?.estimatedShippingFee || '').trim();
        estimatedShippingFeeField.dataset.autoManaged = '1';
      }
      updateWeightAutoHint(form, { active: unitWeight !== null, quantity });
      maybeRecomputeEstimatedShipping(form, { product, sku, force: true });
      recomputeAuto();
    }

    function updateSkuSelect(productTkId = '', selectedSkuId = '', { preserveSnapshot = false } = {}) {
      ensureSearchSelects();
      const skuSelect = $('#ot-sku-select');
      const skuNameField = $('#ot-sku-name');
      if (!skuSelect) return;
      const product = String(productTkId || '').trim() && typeof getProductByTkId === 'function'
        ? getProductByTkId(productTkId)
        : null;
      const skus = getProductSkus(product);
      const normalizedSelected = String(selectedSkuId || '').trim();

      if (!product) {
        skuSelect.value = '';
        if (skuSelectApi) {
          skuSelectApi.setOptions([]);
          skuSelectApi.setValue('', { silent: true });
          skuSelectApi.setDisabled(true);
        }
        if (skuNameField) skuNameField.value = '';
        if (!preserveSnapshot) applyOrderSnapshot({ clearSpec: true });
        return;
      }

      if (!skus.length) {
        skuSelect.value = '';
        if (skuSelectApi) {
          skuSelectApi.setOptions([{ value: '', label: '- 该商品没有 SKU -', searchText: '' }]);
          skuSelectApi.setValue('', { silent: true });
          skuSelectApi.setDisabled(true);
        }
        if (skuNameField) skuNameField.value = '';
        if (!preserveSnapshot) applyOrderSnapshot({ product });
        return;
      }

      const hasMatchedSelected = normalizedSelected && skus.some(sku => String(sku?.skuId || '').trim() === normalizedSelected);
      const options = [{ value: '', label: '- 请选择 SKU -', searchText: '' }];
      skus.forEach(sku => {
        const skuId = String(sku?.skuId || '').trim();
        if (!skuId) return;
        options.push({
          value: skuId,
          label: buildSkuLabel(sku),
          searchText: [sku?.skuId, sku?.skuName].join(' ')
        });
      });
      if (normalizedSelected && !hasMatchedSelected) {
        options.push({
          value: normalizedSelected,
          label: `${normalizedSelected}（已不存在）`,
          searchText: normalizedSelected
        });
      }
      if (skuSelectApi) {
        skuSelectApi.setOptions(options);
        skuSelectApi.setDisabled(false);
      }

      const nextSelected = hasMatchedSelected
        ? normalizedSelected
        : (skus.length === 1 ? String(skus[0].skuId || '').trim() : '');
      if (skuSelectApi) skuSelectApi.setValue(nextSelected, { silent: true });
      else skuSelect.value = nextSelected;

      const matchedSku = nextSelected ? skus.find(sku => String(sku?.skuId || '').trim() === nextSelected) : null;
      if (matchedSku) {
        if (skuNameField) skuNameField.value = String(matchedSku?.skuName || '').trim();
        if (!preserveSnapshot) applyOrderSnapshot({ product, sku: matchedSku });
      } else {
        if (skuNameField) skuNameField.value = '';
        if (!preserveSnapshot) applyOrderSnapshot({ product, clearSpec: true });
      }
    }

    function getOrderItemsContainer() {
      return $('#ot-item-list');
    }

    function getFormFieldValue(form, name) {
      if (!form || !name) return '';
      const directField = form.querySelector?.(`[name="${name}"]`);
      if (directField && typeof directField.value !== 'undefined') return directField.value;
      if (typeof form.entries === 'function') {
        const found = Array.from(form.entries()).find(([key]) => key === name);
        return found ? found[1] : '';
      }
      return '';
    }

    function readLegacyOrderItemsFromForm(form = $('#ot-form')) {
      if (!form) return [];
      const draft = createOrderItemDraft({
        productTkId: getFormFieldValue(form, '商品TK ID'),
        productSkuId: getFormFieldValue(form, '商品SKU ID'),
        productSkuName: getFormFieldValue(form, '商品SKU名称'),
        productName: getFormFieldValue(form, '产品名称'),
        quantity: getFormFieldValue(form, '数量'),
        unitSalePrice: getFormFieldValue(form, '售价'),
        unitPurchasePrice: getFormFieldValue(form, '采购价格'),
        unitWeightG: getFormFieldValue(form, '重量'),
        unitSizeText: getFormFieldValue(form, '尺寸')
      });
      const hasAnyValue = [
        draft.productTkId,
        draft.productSkuId,
        draft.productSkuName,
        draft.productName,
        draft.quantity,
        draft.unitSalePrice,
        draft.unitPurchasePrice,
        draft.unitWeightG,
        draft.unitSizeText
      ].some(value => String(value || '').trim());
      return hasAnyValue ? [draft] : [];
    }

    function readOrderItemsFromDom() {
      const container = getOrderItemsContainer();
      if (!container) return readLegacyOrderItemsFromForm();
      const rows = Array.from(container.querySelectorAll('[data-line-id]')).map(row => createOrderItemDraft({
        lineId: row.dataset.lineId || '',
        productTkId: row.querySelector('[data-item-field="productTkId"]')?.value || '',
        productSkuId: row.querySelector('[data-item-field="productSkuId"]')?.value || '',
        productSkuName: row.querySelector('[data-item-field="productSkuName"]')?.value || '',
        productName: row.querySelector('[data-item-field="productName"]')?.value || '',
        quantity: row.querySelector('[data-item-field="quantity"]')?.value || '',
        unitSalePrice: row.querySelector('[data-item-field="unitSalePrice"]')?.value || '',
        unitPurchasePrice: row.querySelector('[data-item-field="unitPurchasePrice"]')?.value || '',
        unitWeightG: row.querySelector('[data-item-field="unitWeightG"]')?.value || '',
        unitSizeText: row.querySelector('[data-item-field="unitSizeText"]')?.value || '',
        useOrderCourier: null,
        courierCompany: row.querySelector('[data-item-field="courierCompany"]')?.value || '',
        trackingNo: row.querySelector('[data-item-field="trackingNo"]')?.value || ''
      }));
      return rows.length ? rows : readLegacyOrderItemsFromForm(container.closest('form') || $('#ot-form'));
    }

    function cloneOrderItemDrafts(items = []) {
      return (Array.isArray(items) ? items : []).map(createOrderItemDraft);
    }

    function rememberOrderItemDrafts(items = readOrderItemsFromDom()) {
      itemDraftCache = cloneOrderItemDrafts(items);
      return itemDraftCache;
    }

    function mergeOrderItemDraftCache(items = []) {
      const drafts = cloneOrderItemDrafts(items);
      if (!itemDraftCache.length) return drafts;
      const cachedByLineId = new Map(itemDraftCache.map(item => [String(item.lineId || ''), item]));
      return drafts.map(draft => {
        const cached = cachedByLineId.get(String(draft.lineId || ''));
        if (!cached) return draft;
        const next = { ...draft };
        Object.entries(cached).forEach(([key, value]) => {
          if (key === 'lineId') return;
          if (String(next[key] ?? '').trim()) return;
          if (value === null || value === undefined || String(value).trim() === '') return;
          next[key] = value;
        });
        return createOrderItemDraft(next);
      });
    }

    function maybeAutoDetectCourierForItemRow(row) {
      if (!row) return;
      const trackingField = row.querySelector('[data-item-field="trackingNo"]');
      const companyField = row.querySelector('[data-item-field="courierCompany"]');
      if (!trackingField || !companyField) return;
      const tracking = String(trackingField.value || '').trim();
      const currentCompany = String(companyField.value || '').trim();
      const autoDetected = String(companyField.dataset.autoDetectedCourier || '').trim();
      if (!tracking) {
        if (autoDetected && currentCompany === autoDetected) {
          companyField.value = '';
          companyField.dataset.autoDetectedCourier = '';
        }
        return;
      }
      if (currentCompany && currentCompany !== autoDetected) return;
      const detected = String(detectCourierCompany(tracking) || '').trim();
      companyField.value = detected;
      companyField.dataset.autoDetectedCourier = detected;
    }

    async function copyTrackingNumberFromRow(row) {
      if (!row) return;
      const trackingNo = String(row.querySelector('[data-item-field="trackingNo"]')?.value || '').trim();
      if (!trackingNo) {
        if (typeof toast === 'function') toast('这条明细还没有快递单号', 'error');
        return;
      }
      const legacyCopy = () => {
        const textArea = document.createElement('textarea');
        textArea.value = trackingNo;
        textArea.setAttribute('readonly', 'readonly');
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } finally {
          document.body.removeChild(textArea);
        }
      };
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(trackingNo);
        } else {
          legacyCopy();
        }
        if (typeof toast === 'function') toast('已复制快递单号', 'ok');
      } catch (error) {
        try {
          legacyCopy();
          if (typeof toast === 'function') toast('已复制快递单号', 'ok');
        } catch (fallbackError) {
          if (typeof toast === 'function') toast('复制失败，请手动复制', 'error');
        }
      }
    }

    function clearItemCourierAutodetect(row) {
      if (!row) return;
      const companyField = row.querySelector('[data-item-field="courierCompany"]');
      if (companyField) companyField.dataset.autoDetectedCourier = '';
    }

    function getItemRowProduct(accountName = '', tkId = '') {
      const normalizedTkId = String(tkId || '').trim();
      if (!normalizedTkId) return null;
      return (typeof getProductsForAccount === 'function'
        ? getProductsForAccount(normalizeAccountName(accountName))
        : []
      ).find(product => String(product?.tkId || '').trim() === normalizedTkId) || null;
    }

    function buildItemProductOptions(accountName = '', selectedTkId = '') {
      const normalizedSelected = String(selectedTkId || '').trim();
      const products = normalizeAccountName(accountName) && typeof getProductsForAccount === 'function'
        ? getProductsForAccount(normalizeAccountName(accountName))
        : [];
      const options = [{ value: '', label: '- 不关联商品 -', searchText: '' }];
      products.forEach(product => {
        const tkId = String(product?.tkId || '').trim();
        if (!tkId) return;
        options.push({
          value: tkId,
          label: buildProductLabel(product),
          searchText: [
            product?.tkId,
            product?.name,
            ...getProductSkus(product).flatMap(sku => [sku?.skuId, sku?.skuName])
          ].join(' ')
        });
      });
      if (normalizedSelected && !options.some(option => option.value === normalizedSelected)) {
        options.push({
          value: normalizedSelected,
          label: `${normalizedSelected}（已不存在）`,
          searchText: normalizedSelected
        });
      }
      return options;
    }

    function buildItemSkuOptions(product = null, selectedSkuId = '') {
      const normalizedSelected = String(selectedSkuId || '').trim();
      if (!product) return [];
      const skus = getProductSkus(product);
      const options = [{ value: '', label: skus.length ? '- 请选择 SKU -' : '- 该商品没有 SKU -', searchText: '' }];
      skus.forEach(sku => {
        const skuId = String(sku?.skuId || '').trim();
        if (!skuId) return;
        options.push({
          value: skuId,
          label: buildSkuLabel(sku),
          searchText: [sku?.skuId, sku?.skuName].join(' ')
        });
      });
      if (normalizedSelected && !options.some(option => option.value === normalizedSelected)) {
        options.push({
          value: normalizedSelected,
          label: `${normalizedSelected}（已不存在）`,
          searchText: normalizedSelected
        });
      }
      return options;
    }

    function applyItemSnapshot(row, { product = null, sku = null, clearSpec = false } = {}) {
      if (!row) return;
      const productNameField = row.querySelector('[data-item-field="productName"]');
      const skuNameField = row.querySelector('[data-item-field="productSkuName"]');
      const weightField = row.querySelector('[data-item-field="unitWeightG"]');
      const sizeField = row.querySelector('[data-item-field="unitSizeText"]');

      if (productNameField) {
        if (product) productNameField.value = String(product?.name || '').trim();
      }
      if (skuNameField) skuNameField.value = sku ? String(sku?.skuName || '').trim() : '';

      if (clearSpec) {
        if (!product && productNameField) productNameField.value = '';
        if (weightField) weightField.value = '';
        if (sizeField) sizeField.value = '';
        syncOrderSummaryFromItems();
        return;
      }

      const source = resolveProductSnapshotSource(product, sku);
      if (!source) {
        syncOrderSummaryFromItems();
        return;
      }
      if (weightField) weightField.value = String(source?.weightG || '').trim();
      if (sizeField) sizeField.value = formatProductSize(source);
      syncOrderSummaryFromItems();
    }

    function bindItemRowSearchSelects(row) {
      const searchSelect = typeof TKSearchSelect !== 'undefined' ? TKSearchSelect : null;
      if (!row || !searchSelect) return;
      const productRoot = row.querySelector('[data-item-role="product-combobox"]');
      const skuRoot = row.querySelector('[data-item-role="sku-combobox"]');
      const productApi = searchSelect.create(productRoot, {
        placeholder: '- 不关联商品 -',
        searchPlaceholder: '搜索商品ID / 名称',
        onChange(nextValue) {
          const accountName = $('#ot-acc-select')?.value || '';
          const product = getItemRowProduct(accountName, nextValue);
          const skuApiCurrent = row._skuSelectApi || null;
          const skuOptions = buildItemSkuOptions(product, '');
          if (skuApiCurrent) {
            skuApiCurrent.setOptions(skuOptions);
            skuApiCurrent.setDisabled(!product || !getProductSkus(product).length);
            skuApiCurrent.setValue('', { silent: true });
          }
          row.querySelector('[data-item-field="productTkId"]').value = String(nextValue || '').trim();
          row.querySelector('[data-item-field="productSkuId"]').value = '';
          row.querySelector('[data-item-field="productSkuName"]').value = '';
          if (!product) {
            applyItemSnapshot(row, { clearSpec: true });
            return;
          }
          if (!getProductSkus(product).length) {
            applyItemSnapshot(row, { product });
            return;
          }
          row.querySelector('[data-item-field="productName"]').value = String(product?.name || '').trim();
          row.querySelector('[data-item-field="unitWeightG"]').value = '';
          row.querySelector('[data-item-field="unitSizeText"]').value = '';
          syncOrderSummaryFromItems();
        }
      });
      const skuApi = searchSelect.create(skuRoot, {
        placeholder: '- 先选择商品 -',
        searchPlaceholder: '搜索SKU ID / 名称',
        onChange(nextValue) {
          const accountName = $('#ot-acc-select')?.value || '';
          const productTkId = row.querySelector('[data-item-field="productTkId"]').value || '';
          const product = getItemRowProduct(accountName, productTkId);
          const sku = product && nextValue
            ? getProductSkus(product).find(item => String(item?.skuId || '').trim() === String(nextValue || '').trim()) || null
            : null;
          row.querySelector('[data-item-field="productSkuId"]').value = String(nextValue || '').trim();
          row.querySelector('[data-item-field="productSkuName"]').value = sku ? String(sku?.skuName || '').trim() : '';
          if (sku) applyItemSnapshot(row, { product, sku });
          else if (product && !getProductSkus(product).length) applyItemSnapshot(row, { product });
          else if (product) applyItemSnapshot(row, { product, clearSpec: true });
        }
      });
      row._productSelectApi = productApi;
      row._skuSelectApi = skuApi;
    }

    function syncOrderSummaryFromItems() {
      const form = $('#ot-form');
      if (!form) return;
      const items = readOrderItemsFromDom();
      rememberOrderItemDrafts(items);
      const quantityTotal = items.reduce((sum, item) => sum + (Number.parseInt(String(item.quantity || '').trim(), 10) || 0), 0);
      const totalWeight = items.reduce((sum, item) => {
        const qty = Number.parseInt(String(item.quantity || '').trim(), 10) || 0;
        const unit = parseMoneyValue(item.unitWeightG);
        return sum + ((unit || 0) * qty);
      }, 0);

      const totalQtyField = $('#ot-total-quantity');
      if (totalQtyField) totalQtyField.value = quantityTotal ? String(quantityTotal) : '';

      const totalQtyHidden = $('#ot-total-quantity-hidden');
      const productNameHidden = $('#ot-product-name-hidden');
      const productTkHidden = $('#ot-product-select');
      const skuIdHidden = $('#ot-sku-select');
      const skuNameHidden = $('#ot-sku-name');
      if (totalQtyHidden) totalQtyHidden.value = quantityTotal ? String(quantityTotal) : '';
      if (productNameHidden) productNameHidden.value = buildOrderItemsSummary(items);
      if (items.length === 1) {
        if (productTkHidden) productTkHidden.value = items[0].productTkId || '';
        if (skuIdHidden) skuIdHidden.value = items[0].productSkuId || '';
        if (skuNameHidden) skuNameHidden.value = items[0].productSkuName || '';
      } else {
        if (productTkHidden) productTkHidden.value = '';
        if (skuIdHidden) skuIdHidden.value = '';
        if (skuNameHidden) skuNameHidden.value = '';
      }

      const weightField = form.querySelector('[name="重量"]');
      const sizeField = form.querySelector('[name="尺寸"]');
      if (weightField) {
        weightField.value = totalWeight ? formatNumericValue(totalWeight) : '';
        weightField.dataset.autoManaged = totalWeight ? '1' : '';
        updateWeightAutoHint(form, { active: !!totalWeight, quantity: quantityTotal });
      }
      if (sizeField) {
        const onlyItem = items.length === 1 ? items[0] : null;
        const onlyItemSize = onlyItem ? String(onlyItem.unitSizeText || '').trim() : '';
        const shouldAutoSize = sizeField.dataset.autoManaged === '1' || !String(sizeField.value || '').trim();
        if (shouldAutoSize && onlyItemSize) {
          sizeField.value = onlyItemSize;
          sizeField.dataset.autoManaged = '1';
        }
        sizeField.placeholder = '例如 20×15×10';
      }

      maybeRecomputeEstimatedShipping(form, { force: false });
      recomputeAuto();
      return items;
    }

    function buildOrderItemRowMarkup(item = {}) {
      return `
        <div class="ot-item-edit-row" data-line-id="${escapeHtml(item.lineId)}">
          <button type="button" class="ot-item-remove" data-item-action="remove" aria-label="删除明细" title="删除明细">×</button>
          <div class="field ot-item-field ot-item-span-3">
            <label>关联商品</label>
            <div class="tk-search-select" data-item-role="product-combobox">
              <input type="hidden" data-item-field="productTkId" value="${escapeHtml(item.productTkId || '')}">
              <button type="button" class="tk-search-select-trigger" data-role="trigger">
                <span class="tk-search-select-trigger-label" data-role="label">- 不关联商品 -</span>
                <span class="tk-search-select-trigger-icon" aria-hidden="true">▾</span>
              </button>
              <div class="tk-search-select-panel" data-role="panel">
                <div class="tk-search-select-search">
                  <input type="text" data-role="search" placeholder="搜索商品ID / 名称">
                </div>
                <div class="tk-search-select-options" data-role="options"></div>
              </div>
            </div>
          </div>
          <div class="field ot-item-field ot-item-span-3">
            <label>关联SKU</label>
            <div class="tk-search-select" data-item-role="sku-combobox">
              <input type="hidden" data-item-field="productSkuId" value="${escapeHtml(item.productSkuId || '')}">
              <button type="button" class="tk-search-select-trigger" data-role="trigger">
                <span class="tk-search-select-trigger-label" data-role="label">- 先选择商品 -</span>
                <span class="tk-search-select-trigger-icon" aria-hidden="true">▾</span>
              </button>
              <div class="tk-search-select-panel" data-role="panel">
                <div class="tk-search-select-search">
                  <input type="text" data-role="search" placeholder="搜索SKU ID / 名称">
                </div>
                <div class="tk-search-select-options" data-role="options"></div>
              </div>
            </div>
            <input type="hidden" data-item-field="productSkuName" value="${escapeHtml(item.productSkuName || '')}">
          </div>
          <div class="field ot-item-field ot-item-span-3">
            <label>商品名称</label>
            <input type="text" class="pl-sku-inline-input" data-item-field="productName" value="${escapeHtml(item.productName || '')}" placeholder="商品名称">
          </div>
          <div class="field ot-item-field ot-item-span-3">
            <label>快递公司</label>
            <select data-item-field="courierCompany">
              ${buildCourierSelectOptionsMarkup(item.courierCompany || '')}
            </select>
          </div>
          <div class="field ot-item-field ot-item-span-3">
            <label>数量</label>
            <input type="number" class="pl-sku-inline-input" data-item-field="quantity" min="1" step="1" value="${escapeHtml(item.quantity || '1')}">
          </div>
          <div class="field ot-item-field ot-item-span-3">
            <label>单件重量(g)</label>
            <input type="text" class="pl-sku-inline-input" data-item-field="unitWeightG" value="${escapeHtml(item.unitWeightG || '')}" placeholder="单件重量">
          </div>
          <div class="field ot-item-field ot-item-span-3">
            <label>单件尺寸(cm)</label>
            <input type="text" class="pl-sku-inline-input" data-item-field="unitSizeText" value="${escapeHtml(item.unitSizeText || '')}" placeholder="20×15×10">
          </div>
          <div class="field ot-item-field ot-item-span-3">
            <label>快递单号 <span class="ot-item-inline-actions"><button type="button" class="ot-item-inline-btn ot-item-copy-btn" data-item-action="copy-tracking" aria-label="复制当前明细快递单号" title="复制当前明细快递单号"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="3" width="9" height="11" rx="2"></rect><rect x="4" y="6" width="9" height="11" rx="2"></rect></svg></button></span></label>
            <input type="text" class="pl-sku-inline-input" data-item-field="trackingNo" value="${escapeHtml(item.trackingNo || '')}" placeholder="填写这一条明细的单号">
          </div>
        </div>`;
    }

    function renderOrderItems(items = []) {
      const container = getOrderItemsContainer();
      if (!container) return;
      const sourceDrafts = (Array.isArray(items) && items.length ? items : [createOrderItemDraft()]).map(createOrderItemDraft);
      const drafts = mergeOrderItemDraftCache(sourceDrafts);
      container.innerHTML = drafts.map(buildOrderItemRowMarkup).join('');

      const accountName = $('#ot-acc-select')?.value || '';
      Array.from(container.querySelectorAll('[data-line-id]')).forEach((row, index) => {
        const draft = drafts[index];
        bindItemRowSearchSelects(row);
        const product = getItemRowProduct(accountName, draft.productTkId);
        const productApi = row._productSelectApi;
        const skuApi = row._skuSelectApi;
        if (productApi) {
          productApi.setOptions(buildItemProductOptions(accountName, draft.productTkId));
          productApi.setDisabled(!normalizeAccountName(accountName));
          productApi.setValue(draft.productTkId, { silent: true });
        }
        if (skuApi) {
          skuApi.setOptions(buildItemSkuOptions(product, draft.productSkuId));
          skuApi.setDisabled(!product || !getProductSkus(product).length);
          skuApi.setValue(draft.productSkuId, { silent: true });
        }
        if (draft.productSkuName) {
          row.querySelector('[data-item-field="productSkuName"]').value = draft.productSkuName;
        }
      });
      syncOrderSummaryFromItems();
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
      const creatorCommissionField = form.querySelector('[name="达人佣金"]');
      if (warehouseField) warehouseField.value = ordered ? addDays(ordered, 6) : '';
      if (warningField) {
        const temp = Object.fromEntries(new FormData(form).entries());
        warningField.value = computeWarning(temp).text;
      }
      if (creatorCommissionField) {
        creatorCommissionField.value = computeCreatorCommissionFromForm(form);
      }
      if (estimatedProfitField) {
        estimatedProfitField.value = computeEstimatedProfitFromForm(form);
      }
      syncRefundPresentation(form);
    }

    function syncRefundPresentation(form) {
      if (!form) return;
      const refundedField = form.querySelector('[name="是否退款"]');
      const saleInput = form.querySelector('[name="售价"]');
      const saleField = form.querySelector('.ot-sale-field');
      const saleOriginal = form.querySelector('.ot-sale-input-original');
      if (!refundedField || !saleInput || !saleField) return;
      const refunded = !!refundedField.checked;
      const saleText = String(saleInput.value || '').trim();
      saleField.classList.toggle('is-refunded', refunded);
      saleInput.readOnly = refunded;
      if (saleOriginal) saleOriginal.textContent = saleText || '-';
      if (refunded && typeof saleInput.blur === 'function') saleInput.blur();
    }

    function getOrderQuantityValue(form) {
      if (!form) return 1;
      const raw = String(form.querySelector('[name="数量"]')?.value || '').trim();
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }

    function updateWeightAutoHint(form, { active = false, quantity = 1 } = {}) {
      const hint = form?.querySelector?.('#ot-weight-hint');
      if (!hint) return;
      hint.textContent = active && quantity > 1 ? '已按各 SKU 单件重量 × 数量汇总' : '';
    }

    function resetSpecAutoState(form) {
      const weightField = form?.querySelector?.('[name="重量"]');
      const sizeField = form?.querySelector?.('[name="尺寸"]');
      const estimatedShippingFeeField = form?.querySelector?.('[name="预估运费"]');
      if (weightField) {
        weightField.dataset.autoManaged = '';
        weightField.dataset.unitWeight = '';
      }
      if (sizeField) {
        sizeField.dataset.autoManaged = '';
        sizeField.dataset.autoTemplate = '';
        sizeField.placeholder = '例如 20×15×10';
      }
      if (estimatedShippingFeeField) estimatedShippingFeeField.dataset.autoManaged = '';
      updateWeightAutoHint(form, { active: false });
    }

    function getSelectedProductAndSku(form) {
      const productTkId = String(form?.querySelector?.('[name="商品TK ID"]')?.value || '').trim();
      const product = productTkId && typeof getProductByTkId === 'function'
        ? getProductByTkId(productTkId)
        : null;
      const skuId = String(form?.querySelector?.('[name="商品SKU ID"]')?.value || '').trim();
      const sku = product && skuId
        ? getProductSkus(product).find(item => String(item?.skuId || '').trim() === skuId) || null
        : null;
      return { product, sku };
    }

    function syncOrderSpecFromQuantity() {
      const form = $('#ot-form');
      if (!form) return;
      const weightField = form.querySelector('[name="重量"]');
      const sizeField = form.querySelector('[name="尺寸"]');
      if (!weightField || !sizeField) return;

      const quantity = getOrderQuantityValue(form);
      const { product, sku } = getSelectedProductAndSku(form);
      const source = resolveProductSnapshotSource(product, sku);
      const unitWeight = parseMoneyValue(weightField.dataset.unitWeight || source?.weightG || '');

      if (unitWeight !== null && weightField.dataset.autoManaged === '1') {
        weightField.value = formatNumericValue(unitWeight * quantity);
      }
      updateWeightAutoHint(form, {
        active: unitWeight !== null && weightField.dataset.autoManaged === '1',
        quantity
      });

      const sizeTemplate = sizeField.dataset.autoTemplate || formatProductSize(source);
      sizeField.placeholder = '例如 20×15×10';
      if (sizeField.dataset.autoManaged === '1' && sizeTemplate) {
        sizeField.value = sizeTemplate;
      }

      maybeRecomputeEstimatedShipping(form, { product, sku });
      recomputeAuto();
    }

    function computeEstimatedShippingFromForm(form, product = null, sku = null) {
      if (!form || !shippingCore?.computeShippingQuote || !shippingCore?.computeCalculatedShippingCost) return '';
      const pricingContext = typeof getPricingContext === 'function' ? getPricingContext() : null;
      if (!pricingContext?.rate) return '';
      const source = resolveProductSnapshotSource(product, sku);
      const itemCargoTypes = readOrderItemsFromDom().map(item => {
        const itemProduct = item.productTkId ? getItemRowProduct(form.querySelector('[name="账号"]')?.value || '', item.productTkId) : null;
        const itemSku = itemProduct && item.productSkuId
          ? getProductSkus(itemProduct).find(row => String(row?.skuId || '').trim() === String(item.productSkuId || '').trim()) || null
          : null;
        return String(resolveProductSnapshotSource(itemProduct, itemSku)?.cargoType || getProductDefaults(itemProduct || {})?.cargoType || '').trim();
      }).filter(Boolean);
      const cargoType = itemCargoTypes.includes('special')
        ? 'special'
        : String(source?.cargoType || getProductDefaults(product || {})?.cargoType || 'general').trim() || 'general';
      const actualWeight = parseMoneyValue(form.querySelector('[name="重量"]')?.value || '');
      if (actualWeight === null || actualWeight <= 0) return '';
      const size = parseSizeText(form.querySelector('[name="尺寸"]')?.value || '');
      const quote = shippingCore.computeShippingQuote({
        cargoType,
        actualWeight,
        length: size.lengthCm,
        width: size.widthCm,
        height: size.heightCm,
        rate: pricingContext.rate
      });
      const finalFee = shippingCore.computeCalculatedShippingCost({
        quote,
        multiplier: pricingContext.shippingMultiplier,
        labelFee: pricingContext.labelFee
      });
      return finalFee === null ? '' : formatNumericValue(finalFee);
    }

    function maybeRecomputeEstimatedShipping(form, { product = null, sku = null, force = false } = {}) {
      const estimatedShippingFeeField = form?.querySelector?.('[name="预估运费"]');
      if (!estimatedShippingFeeField) return;
      const nextValue = computeEstimatedShippingFromForm(form, product, sku);
      const currentValue = String(estimatedShippingFeeField.value || '').trim();
      const isAutoManaged = estimatedShippingFeeField.dataset.autoManaged === '1';
      if (!nextValue) {
        if (!force && currentValue && !isAutoManaged) return;
        estimatedShippingFeeField.value = '';
        estimatedShippingFeeField.dataset.autoManaged = '';
        return;
      }
      estimatedShippingFeeField.value = nextValue;
      estimatedShippingFeeField.dataset.autoManaged = nextValue ? '1' : '';
    }

    function resolveExchangeRate() {
      const sharedRate = typeof getPricingExchangeRate === 'function'
        ? parseMoneyValue(getPricingExchangeRate())
        : null;
      return sharedRate !== null && sharedRate > 0 ? sharedRate : null;
    }

    function computeEstimatedProfitValue({ salePrice = '', purchasePrice = '', estimatedShippingFee = '', creatorCommissionRate = '', isRefunded = '' } = {}) {
      const exchangeRate = resolveExchangeRate();
      const refunded = isRefundedOrder({ '是否退款': isRefunded });
      const creatorCommissionValue = computeCreatorCommissionValue({
        salePrice,
        creatorCommissionRate,
        isRefunded
      });
      const creatorCommission = parseMoneyValue(creatorCommissionValue);
      const sharedProfit = typeof computeOrderEstimatedProfit === 'function'
        ? computeOrderEstimatedProfit({
          '售价': salePrice,
          '采购价格': purchasePrice,
          '预估运费': estimatedShippingFee,
          '达人佣金率': creatorCommissionRate,
          '是否退款': refunded ? '1' : ''
        }, exchangeRate)
        : null;
      if (sharedProfit !== null) return formatMoneyValue(sharedProfit);

      const sale = refunded ? 0 : parseMoneyValue(salePrice);
      const purchase = parseMoneyValue(purchasePrice);
      const shipping = parseMoneyValue(estimatedShippingFee);
      if (exchangeRate === null || sale === null || purchase === null || shipping === null || creatorCommission === null) return '';
      return formatMoneyValue((sale / exchangeRate) - (purchase + shipping + creatorCommission));
    }

    function computeCreatorCommissionValue({ salePrice = '', creatorCommissionRate = '', isRefunded = '' } = {}) {
      const exchangeRate = resolveExchangeRate();
      const refunded = isRefundedOrder({ '是否退款': isRefunded });
      const sharedCommission = typeof computeOrderCreatorCommission === 'function'
        ? computeOrderCreatorCommission({
          '售价': salePrice,
          '达人佣金率': creatorCommissionRate,
          '是否退款': refunded ? '1' : ''
        }, exchangeRate)
        : null;
      if (sharedCommission !== null) return formatMoneyValue(sharedCommission);

      const sale = parseMoneyValue(salePrice);
      const rate = parseMoneyValue(creatorCommissionRate);
      if (exchangeRate === null) return '';
      if (rate === null || rate <= 0) return '0';
      if (refunded) return '0';
      if (sale === null || sale <= 0) return '';
      return formatMoneyValue((sale / exchangeRate) * (rate / 100));
    }

    function computeEstimatedProfitFromForm(form) {
      if (!form) return '';
      return computeEstimatedProfitValue({
        salePrice: form.querySelector('[name="售价"]')?.value || '',
        purchasePrice: form.querySelector('[name="采购价格"]')?.value || '',
        estimatedShippingFee: form.querySelector('[name="预估运费"]')?.value || '',
        creatorCommissionRate: form.querySelector('[name="达人佣金率"]')?.value || '',
        isRefunded: form.querySelector('[name="是否退款"]')?.checked ? '1' : ''
      });
    }

    function computeCreatorCommissionFromForm(form) {
      if (!form) return '';
      return computeCreatorCommissionValue({
        salePrice: form.querySelector('[name="售价"]')?.value || '',
        creatorCommissionRate: form.querySelector('[name="达人佣金率"]')?.value || '',
        isRefunded: form.querySelector('[name="是否退款"]')?.checked ? '1' : ''
      });
    }

    async function prepareProductsBeforeEditing() {
      if (Array.isArray(state.products) && state.products.length) return;
      if (typeof loadProductsForModal !== 'function') return;
      const timeout = new Promise(resolve => setTimeout(resolve, 120));
      await Promise.race([
        Promise.resolve(loadProductsForModal({ silent: true, force: false })).catch(() => []),
        timeout
      ]);
    }

    async function openModal(editId = null) {
      const form = $('#ot-form');
      const modal = $('#ot-modal');
      if (!form || !modal) return;
      await prepareProductsBeforeEditing();
      form.reset();
      resetSpecAutoState(form);
      state.editingId = editId;
      const openToken = uid();
      modal.dataset.openToken = openToken;
      itemDraftCache = [];
      ensureSearchSelects();
      if (editId) {
        const found = (state.orders || []).find(order => order.id === editId);
        if (!found) return;
        const order = normalizeOrderRecord(found);
        $('#ot-modal-title').textContent = '编辑订单';
        updateModalAccountSelect(order['账号'] || '');
        ensureOrderStatusOption(order['订单状态']);
        Object.entries(order).forEach(([key, value]) => {
          if (key === '账号' || key === 'items') return;
          const input = form.querySelector(`[name="${key}"]`);
          if (!input) return;
          if (String(input.type || '').toLowerCase() === 'checkbox') {
            input.checked = String(value || '').trim() === '1';
            return;
          }
          input.value = value ?? '';
        });
        renderOrderItems(getOrderItemsFromOrder(order));
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
        renderOrderItems([createOrderItemDraft()]);
      }

      maybeAutoDetectCourierFromForm();
      syncOrderSummaryFromItems();
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
      const form = event.target;
      const items = syncOrderSummaryFromItems() || [];
      if (!items.length) {
        toast('请至少添加一条订单明细', 'error');
        return;
      }
      const payload = normalizeOrderRecord(Object.fromEntries(new FormData(event.target).entries()));
      payload['是否退款'] = event.target?.querySelector?.('[name="是否退款"]')?.checked ? '1' : '';
      const accountName = payload['账号'] || '';
      for (const item of items) {
        const product = item.productTkId ? getItemRowProduct(accountName, item.productTkId) : null;
        const relatedSkus = getProductSkus(product);
        if (!item.productTkId && !item.productName) {
          toast('请填写每条明细的商品名称，或先关联商品', 'error');
          return;
        }
        if (product && relatedSkus.length && !String(item.productSkuId || '').trim()) {
          toast(`商品「${product.name || item.productTkId}」有多个 SKU，请先选择具体规格`, 'error');
          return;
        }
        if (!String(item.quantity || '').trim() || (Number.parseInt(item.quantity, 10) || 0) <= 0) {
          toast('请填写有效的明细数量', 'error');
          return;
        }
        if (product && item.productSkuId) {
          const matchedSku = relatedSkus.find(sku => String(sku?.skuId || '').trim() === String(item.productSkuId || '').trim());
          item.productSkuName = matchedSku ? String(matchedSku?.skuName || '').trim() : String(item.productSkuName || '').trim();
        }
        if (!item.courierCompany && item.trackingNo) {
          item.courierCompany = detectCourierCompany(item.trackingNo);
        }
      }
      payload.items = items;
      if (payload['账号'] === '__ADD__') {
        toast('请选择有效的账号', 'error');
        return;
      }
      if (!String(payload['订单号'] || '').trim()) {
        toast('请填写订单号', 'error');
        const orderNoField = event.target?.querySelector?.('[name="订单号"]');
        if (orderNoField && typeof orderNoField.focus === 'function') orderNoField.focus();
        return;
      }
      const uniqueCompanies = Array.from(new Set(items.map(item => String(item.courierCompany || '').trim()).filter(Boolean)));
      const uniqueTrackings = Array.from(new Set(items.map(item => String(item.trackingNo || '').trim()).filter(Boolean)));
      payload['快递公司'] = uniqueCompanies.length === 1 ? uniqueCompanies[0] : '';
      payload['快递单号'] = uniqueTrackings.length === 1 ? uniqueTrackings[0] : '';
      payload['预估利润'] = computeEstimatedProfitValue({
        salePrice: payload['售价'],
        purchasePrice: payload['采购价格'],
        estimatedShippingFee: payload['预估运费'],
        creatorCommissionRate: payload['达人佣金率'],
        isRefunded: payload['是否退款']
      });
      payload['达人佣金'] = computeCreatorCommissionValue({
        salePrice: payload['售价'],
        creatorCommissionRate: payload['达人佣金率'],
        isRefunded: payload['是否退款']
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
      if (!window.confirm('确定删除这条订单？删除后如需恢复，需要从你的 Firestore 历史记录或备份手动恢复。')) return;
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
      const quantityField = form.querySelector('[name="数量"]');
      const purchasePrice = form.querySelector('[name="采购价格"]');
      const salePrice = form.querySelector('[name="售价"]');
      const creatorCommissionRate = form.querySelector('[name="达人佣金率"]');
      const estimatedShippingFee = form.querySelector('[name="预估运费"]');
      const refundedField = form.querySelector('[name="是否退款"]');
      const weightField = form.querySelector('[name="重量"]');
      const sizeField = form.querySelector('[name="尺寸"]');
      if (orderDate) orderDate.addEventListener('change', recomputeAuto);
      if (quantityField) {
        quantityField.addEventListener('input', syncOrderSpecFromQuantity);
        quantityField.addEventListener('change', syncOrderSpecFromQuantity);
      }
      [purchasePrice, salePrice, creatorCommissionRate, estimatedShippingFee].forEach(field => {
        if (!field) return;
        field.addEventListener('input', recomputeAuto);
        field.addEventListener('change', recomputeAuto);
      });
      if (refundedField) {
        refundedField.addEventListener('change', recomputeAuto);
      }
      if (estimatedShippingFee) {
        const handleEstimatedShippingInput = () => {
          recomputeAuto();
          estimatedShippingFee.dataset.autoManaged = '';
        };
        const handleEstimatedShippingChange = () => {
          recomputeAuto();
          estimatedShippingFee.dataset.autoManaged = '';
        };
        estimatedShippingFee.addEventListener('input', handleEstimatedShippingInput);
        estimatedShippingFee.addEventListener('change', handleEstimatedShippingChange);
      }
      if (weightField) {
        const markManualWeight = () => {
          weightField.dataset.autoManaged = '';
          updateWeightAutoHint(form, { active: false });
          maybeRecomputeEstimatedShipping(form);
          recomputeAuto();
        };
        weightField.addEventListener('input', markManualWeight);
        weightField.addEventListener('change', markManualWeight);
      }
      if (sizeField) {
        const markManualSize = () => {
          sizeField.dataset.autoManaged = '';
          maybeRecomputeEstimatedShipping(form);
          recomputeAuto();
        };
        sizeField.addEventListener('input', markManualSize);
        sizeField.addEventListener('change', markManualSize);
      }
      if (orderStatus) orderStatus.addEventListener('change', recomputeAuto);

      const courierFields = getOrderFormCourierFields();
      if (courierFields.tracking) {
        courierFields.tracking.addEventListener('input', () => {
          maybeAutoDetectCourierFromForm();
        });
        courierFields.tracking.addEventListener('blur', () => {
          maybeAutoDetectCourierFromForm();
        });
        courierFields.tracking.addEventListener('change', () => {
          maybeAutoDetectCourierFromForm();
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
      const addItemBtn = $('#ot-add-item-btn');
      const itemList = getOrderItemsContainer();
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
            renderOrderItems(readOrderItemsFromDom());
            prevAccValue = newName;
          } else {
            accountSelect.value = prevAccValue;
          }
        } else {
          prevAccValue = accountSelect.value;
          renderOrderItems(readOrderItemsFromDom());
        }
      });
      if (addItemBtn) {
        addItemBtn.addEventListener('click', () => {
          const drafts = readOrderItemsFromDom();
          drafts.push(createOrderItemDraft());
          renderOrderItems(drafts);
        });
      }
      if (itemList) {
        itemList.addEventListener('click', event => {
          const removeBtn = event.target.closest('[data-item-action="remove"]');
          const copyBtn = event.target.closest('[data-item-action="copy-tracking"]');
          const row = event.target.closest('[data-line-id]');
          if (removeBtn && row) {
            const drafts = readOrderItemsFromDom().filter(item => item.lineId !== row.dataset.lineId);
            renderOrderItems(drafts.length ? drafts : [createOrderItemDraft()]);
            return;
          }
          if (copyBtn && row) {
            copyTrackingNumberFromRow(row);
            return;
          }
        });
        itemList.addEventListener('input', event => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          if (!target.matches('[data-item-field]')) return;
          if (target.dataset.itemField === 'trackingNo') {
            maybeAutoDetectCourierForItemRow(target.closest('[data-line-id]'));
          }
          syncOrderSummaryFromItems();
        });
        itemList.addEventListener('change', event => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          if (!target.matches('[data-item-field]')) return;
          if (target.dataset.itemField === 'courierCompany') {
            clearItemCourierAutodetect(target.closest('[data-line-id]'));
          }
          if (target.dataset.itemField === 'trackingNo') {
            maybeAutoDetectCourierForItemRow(target.closest('[data-line-id]'));
          }
          syncOrderSummaryFromItems();
        });
      }
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
