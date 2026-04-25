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
      computeOrderEstimatedProfit,
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

    function updateModalAccountSelect(selectedAcc) {
      const select = $('#ot-acc-select');
      if (!select) return;
      const accounts = getUniqueAccounts();
      select.innerHTML = accounts.map(account => `<option value="${escapeHtml(account)}">${escapeHtml(account)}</option>`).join('')
        + '<option value="__ADD__">+ 添加新账号...</option>';
      if (selectedAcc && accounts.includes(selectedAcc)) select.value = selectedAcc;
      else if (accounts.length) select.value = accounts[0];
    }

    function formatProductSize(product = {}) {
      const values = [product?.lengthCm, product?.widthCm, product?.heightCm]
        .map(value => String(value ?? '').trim())
        .filter(Boolean);
      return values.length === 3 ? values.join('×') : '';
    }

    function buildProductLabel(product = {}) {
      const tkId = String(product?.tkId || '').trim();
      const name = String(product?.name || '').trim();
      if (tkId && name) return `${tkId} - ${name}`;
      return tkId || name || '';
    }

    function getProductSkus(product = {}) {
      return Array.isArray(product?.skus) ? product.skus.filter(sku => String(sku?.skuId || '').trim()) : [];
    }

    function buildSkuLabel(sku = {}) {
      const skuId = String(sku?.skuId || '').trim();
      const skuName = String(sku?.skuName || '').trim();
      if (skuId && skuName) return `${skuName} - ${skuId}`;
      return skuName || skuId || '未命名SKU';
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

    function getProductDefaults(product = {}) {
      return product?.defaults && typeof product.defaults === 'object'
        ? product.defaults
        : product;
    }

    function resolveProductSnapshotSource(product = null, sku = null) {
      const defaults = getProductDefaults(product || {});
      if (!sku) return defaults || null;
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

    function createOrderItemDraft(seed = {}) {
      const quantityRaw = Number.parseInt(String(seed.quantity ?? seed['数量'] ?? '').trim(), 10);
      return {
        lineId: String(seed.lineId || uid()),
        productTkId: String(seed.productTkId || seed['商品TK ID'] || '').trim(),
        productSkuId: String(seed.productSkuId || seed['商品SKU ID'] || '').trim(),
        productSkuName: String(seed.productSkuName || seed['商品SKU名称'] || '').trim(),
        productName: String(seed.productName || seed['产品名称'] || '').trim(),
        quantity: Number.isFinite(quantityRaw) && quantityRaw > 0 ? String(quantityRaw) : '1',
        unitSalePrice: String(seed.unitSalePrice ?? seed['单件售价'] ?? seed['售价'] ?? '').trim(),
        unitPurchasePrice: String(seed.unitPurchasePrice ?? seed['单件采购价'] ?? seed['采购价格'] ?? '').trim(),
        unitWeightG: String(seed.unitWeightG ?? seed['单件重量'] ?? seed['重量'] ?? '').trim(),
        unitSizeText: String(seed.unitSizeText ?? seed['单件尺寸'] ?? seed['尺寸'] ?? '').trim()
      };
    }

    function buildLegacyOrderItems(order = {}) {
      const hasLegacyValues = [
        order?.['商品TK ID'],
        order?.['商品SKU ID'],
        order?.['产品名称'],
        order?.['数量'],
        order?.['售价'],
        order?.['采购价格'],
        order?.['重量'],
        order?.['尺寸']
      ].some(value => String(value || '').trim());
      if (!hasLegacyValues) return [createOrderItemDraft()];
      return [createOrderItemDraft(order)];
    }

    function getOrderItemsFromOrder(order = {}) {
      if (Array.isArray(order?.items) && order.items.length) {
        return order.items.map(createOrderItemDraft);
      }
      return buildLegacyOrderItems(order);
    }

    function buildOrderItemLabel(item = {}) {
      const productName = String(item?.productName || '').trim();
      const skuName = String(item?.productSkuName || '').trim();
      if (productName && skuName) return `${productName} - ${skuName}`;
      return productName || skuName || '';
    }

    function buildOrderItemsSummary(items = []) {
      const lines = (Array.isArray(items) ? items : []).filter(item => buildOrderItemLabel(item));
      return lines.map(buildOrderItemLabel).join(' / ');
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
        unitSizeText: row.querySelector('[data-item-field="unitSizeText"]')?.value || ''
      }));
      return rows.length ? rows : readLegacyOrderItemsFromForm(container.closest('form') || $('#ot-form'));
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
          <button type="button" class="btn sm danger ot-item-remove" data-item-action="remove">删除</button>
          <div class="field ot-item-field ot-item-span-4">
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
          <div class="field ot-item-field ot-item-span-4">
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
          <div class="field ot-item-field ot-item-span-4">
            <label>商品名称</label>
            <input type="text" class="pl-sku-inline-input" data-item-field="productName" value="${escapeHtml(item.productName || '')}" placeholder="商品名称">
          </div>
          <div class="field ot-item-field ot-item-span-4">
            <label>数量</label>
            <input type="number" class="pl-sku-inline-input" data-item-field="quantity" min="1" step="1" value="${escapeHtml(item.quantity || '1')}">
          </div>
          <div class="field ot-item-field ot-item-span-4">
            <label>单件重量(g)</label>
            <input type="text" class="pl-sku-inline-input" data-item-field="unitWeightG" value="${escapeHtml(item.unitWeightG || '')}" placeholder="单件重量">
          </div>
          <div class="field ot-item-field ot-item-span-4">
            <label>单件尺寸(cm)</label>
            <input type="text" class="pl-sku-inline-input" data-item-field="unitSizeText" value="${escapeHtml(item.unitSizeText || '')}" placeholder="20×15×10">
          </div>
        </div>`;
    }

    function renderOrderItems(items = []) {
      const container = getOrderItemsContainer();
      if (!container) return;
      const drafts = (Array.isArray(items) && items.length ? items : [createOrderItemDraft()]).map(createOrderItemDraft);
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

    function formatNumericValue(value) {
      if (!Number.isFinite(value)) return '';
      return value.toFixed(2).replace(/\.?0+$/, '');
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

    function parseSizeText(value) {
      const matched = String(value || '')
        .trim()
        .replace(/[Xx＊*]/g, '×')
        .match(/\d+(?:\.\d+)?/g);
      if (!matched || matched.length < 3) {
        return {
          lengthCm: '',
          widthCm: '',
          heightCm: ''
        };
      }
      const [lengthCm, widthCm, heightCm] = matched.slice(0, 3).map(part => Number.parseFloat(part));
      return {
        lengthCm: Number.isFinite(lengthCm) ? lengthCm : '',
        widthCm: Number.isFinite(widthCm) ? widthCm : '',
        heightCm: Number.isFinite(heightCm) ? heightCm : ''
      };
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
      estimatedShippingFeeField.value = nextValue;
      estimatedShippingFeeField.dataset.autoManaged = nextValue ? '1' : '';
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

    async function openModal(editId = null) {
      const form = $('#ot-form');
      const modal = $('#ot-modal');
      if (!form || !modal) return;
      form.reset();
      resetSpecAutoState(form);
      state.editingId = editId;
      if (typeof loadProductsForModal === 'function') {
        await loadProductsForModal({ silent: false, force: true });
      }
      ensureSearchSelects();
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
          if (key === '账号' || key === 'items') return;
          const input = form.querySelector(`[name="${key}"]`);
          if (input) input.value = value ?? '';
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
      maybeAutoSetInTransitFromTracking();
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
      const estimatedShippingFee = form.querySelector('[name="预估运费"]');
      const weightField = form.querySelector('[name="重量"]');
      const sizeField = form.querySelector('[name="尺寸"]');
      if (orderDate) orderDate.addEventListener('change', recomputeAuto);
      if (quantityField) {
        quantityField.addEventListener('input', syncOrderSpecFromQuantity);
        quantityField.addEventListener('change', syncOrderSpecFromQuantity);
      }
      [purchasePrice, salePrice, estimatedShippingFee].forEach(field => {
        if (!field) return;
        field.addEventListener('input', recomputeAuto);
        field.addEventListener('change', recomputeAuto);
      });
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
          if (!removeBtn) return;
          const row = removeBtn.closest('[data-line-id]');
          if (!row) return;
          const drafts = readOrderItemsFromDom().filter(item => item.lineId !== row.dataset.lineId);
          renderOrderItems(drafts.length ? drafts : [createOrderItemDraft()]);
        });
        itemList.addEventListener('input', event => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          if (!target.matches('[data-item-field]')) return;
          syncOrderSummaryFromItems();
        });
        itemList.addEventListener('change', event => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          if (!target.matches('[data-item-field]')) return;
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
