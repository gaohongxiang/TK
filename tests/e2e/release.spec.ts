import { test, expect, type Page } from '@playwright/test';

type E2eFirestoreStore = Record<string, Record<string, any>>;

declare global {
  const Buffer: {
    from(value: string): Uint8Array;
  };

  interface Window {
    __tkE2eFirestoreStore: E2eFirestoreStore;
    __tkE2eAnalyticsRows: unknown[][];
  }
}

const ANALYTICS_ROWS = [
  ['2026-04-27 ~ 2026-05-03'],
  [
    'ID',
    '商品',
    '状态',
    'GMV',
    '成交件数',
    '订单数',
    '商城页 GMV',
    '商城商品成交件数',
    '商城页发品曝光次数',
    '商城页面浏览次数',
    '商城页去重商品客户数',
    '商城点击率',
    '商城转化率',
    '视频归因 GMV',
    '视频归因成交件数',
    '视频曝光次数',
    '来自视频的页面浏览次数',
    '视频去重商品客户数',
    '视频点击率',
    '视频转化率',
    '商品卡归因 GMV',
    '商品卡归因成交件数',
    '商品卡曝光次数',
    '商品卡的页面浏览次数',
    '商品卡去重客户数',
    '商品卡点击率',
    '商品卡转化率',
    '直播归因 GMV',
    '直播归因成交件数',
    '直播曝光次数',
    '直播的页面浏览次数',
    '直播去重商品客户数',
    '直播点击率',
    '直播转化率'
  ],
  [
    '1001',
    '雨衣',
    'Active',
    '70,036円',
    '58',
    '51',
    '10,000円',
    '8',
    '1000',
    '120',
    '80',
    '12%',
    '10%',
    '50,000円',
    '42',
    '6000',
    '320',
    '210',
    '5.33%',
    '20%',
    '9,000円',
    '7',
    '1800',
    '90',
    '70',
    '5%',
    '10%',
    '1,036円',
    '1',
    '200',
    '12',
    '10',
    '6%',
    '10%'
  ],
  [
    '1002',
    '水杯',
    'Active',
    '0円',
    '0',
    '0',
    '0円',
    '0',
    '3000',
    '20',
    '18',
    '0.67%',
    '0%',
    '0円',
    '0',
    '0',
    '0',
    '0',
    '0%',
    '0%',
    '0円',
    '0',
    '0',
    '0',
    '0',
    '0%',
    '0%',
    '0円',
    '0',
    '0',
    '0',
    '0',
    '0%',
    '0%'
  ]
];

async function installOfflineFixtures(page: Page) {
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.fulfill({
    contentType: 'application/javascript',
    body: ''
  }));
  await page.route('https://cdn.sheetjs.com/**', route => route.fulfill({
    contentType: 'application/javascript',
    body: ''
  }));

  await page.addInitScript(rows => {
    const now = '2026-05-05T00:00:00.000Z';
    const currentUser = {
      uid: 'tk-e2e-user',
      email: 'tester@example.com'
    };
    const firestoreConfig = {
      apiKey: 'e2e-api-key',
      authDomain: 'tk-e2e.firebaseapp.com',
      projectId: 'tk-e2e',
      appId: '1:123:web:e2e'
    };
    localStorage.clear();
    localStorage.setItem('tk.firestore.cfg.v1', JSON.stringify({
      configText: JSON.stringify(firestoreConfig, null, 2),
      projectId: firestoreConfig.projectId,
      user: ''
    }));

    window.__tkE2eFirestoreStore = {
      products: {},
      orders: {},
      order_accounts: {
        'Test-Account': {
          id: 'Test-Account',
          name: 'Test-Account',
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        }
      },
      sync_state: {
        app: {
          scope: 'app',
          updatedAt: now,
          schemaVersion: 1
        }
      },
      members: {
        [currentUser.email]: {
          uid: currentUser.uid,
          email: currentUser.email,
          role: 'owner',
          modules: ['products', 'orders', 'finance', 'collection', 'analytics'],
          createdAt: now,
          updatedAt: now
        }
      },
      _tk_config: {
        project: {
          initialized: true,
          projectId: firestoreConfig.projectId,
          updatedAt: now
        },
        owner: {
          email: currentUser.email,
          uid: currentUser.uid,
          createdAt: now,
          updatedAt: now
        }
      },
      collection_records: {
        'tk-e2e-collection': {
          productKey: 'tk-e2e-collection',
          accountName: 'Test-Account',
          productId: 'FM-P-001',
          productUrl: 'https://example.test/product',
          fastmossUrl: 'https://example.test/shop',
          shopName: 'Fast Shop',
          productName: 'E2E 露营挂钩',
          collectStatus: '已采集',
          collectedToDxm: true,
          collectedAt: null,
          collectFailureReason: null,
          note: '',
          lastDatasetKey: 'records',
          source: 'fastmoss',
          createdAt: now,
          updatedAt: now,
          datasets: {
            records: {
              filename: 'collection_records.csv',
              headers: ['账号', '选品分', '商品名称', '店铺名', '商品价格', '商品近7天销量', '商品链接', '采集时间', '采集状态', '选品判断', '店小秘编辑状态', '编辑判断'],
              row: {
                '账号': 'Test-Account',
                '选品分': '88',
                '商品名称': 'E2E 露营挂钩',
                '店铺名': 'Fast Shop',
                '商品价格': '980円',
                '商品近7天销量': '12',
                '商品链接': 'https://example.test/product',
                '采集时间': now,
                '采集状态': '已采集',
                '选品判断': '露营收纳场景明确，轻小件，已采集到店小秘。',
                '店小秘编辑状态': '未编辑',
                '编辑判断': ''
              },
              updatedAt: now
            }
          }
        }
      },
      collection_excluded_products: {},
      analytics_snapshots: {},
      analytics_records: {},
      _tk_probe: {}
    };

    function clone(value) {
      return JSON.parse(JSON.stringify(value ?? null));
    }

    function collectionStore(name: string) {
      if (!window.__tkE2eFirestoreStore[name]) window.__tkE2eFirestoreStore[name] = {};
      return window.__tkE2eFirestoreStore[name];
    }

    function makeDocRef(collectionName: string, id: string) {
      return {
        id,
        async set(data: any, options: { merge?: boolean } = {}) {
          const store = collectionStore(collectionName);
          const next = clone(data) || {};
          store[id] = options.merge ? { ...(store[id] || {}), ...next } : next;
        },
        async delete() {
          delete collectionStore(collectionName)[id];
        },
        async get() {
          const value = collectionStore(collectionName)[id];
          return {
            id,
            exists: !!value,
            data: () => clone(value || {})
          };
        }
      };
    }

    function makeCollectionRef(collectionName: string) {
      const ref = {
        doc(id: string) {
          return makeDocRef(collectionName, String(id || '').trim());
        },
        orderBy() {
          return ref;
        },
        limit() {
          return ref;
        },
        async get() {
          const docs = Object.entries(collectionStore(collectionName)).map(([id, data]) => ({
            id,
            data: () => clone(data)
          }));
          return { docs };
        }
      };
      return ref;
    }

    const db = {
      settings() {},
      async enablePersistence() {},
      collection: makeCollectionRef,
      batch() {
        const operations = [];
        return {
          set(ref: any, data: any, options: { merge?: boolean }) {
            operations.push(() => ref.set(data, options));
          },
          delete(ref: any) {
            operations.push(() => ref.delete());
          },
          async commit() {
            for (const apply of operations) await apply();
          }
        };
      }
    };
    const auth = {
      currentUser,
      onAuthStateChanged(callback: (user: typeof currentUser | null) => void) {
        setTimeout(() => callback(auth.currentUser), 0);
        return () => {};
      },
      async signInWithEmailAndPassword() {
        auth.currentUser = currentUser;
        return { user: currentUser };
      },
      async createUserWithEmailAndPassword() {
        auth.currentUser = currentUser;
        return { user: currentUser };
      },
      async sendPasswordResetEmail() {},
      async signOut() {
        auth.currentUser = null;
      }
    };

    window.firebase = {
      apps: [],
      initializeApp(config, name = '[DEFAULT]') {
        const existing = this.apps.find(app => app.name === name);
        if (existing) return existing;
        const app = {
          name,
          options: config,
          firestore: () => db,
          auth: () => auth
        };
        this.apps.push(app);
        return app;
      }
    };

    window.__tkE2eAnalyticsRows = rows;
    window.XLSX = {
      read() {
        return {
          SheetNames: ['Sheet1'],
          Sheets: { Sheet1: {} }
        };
      },
      utils: {
        sheet_to_json() {
          return window.__tkE2eAnalyticsRows;
        }
      }
    };
  }, ANALYTICS_ROWS);
}

function installRuntimeGuards(page: Page) {
  const issues: string[] = [];

  page.on('console', message => {
    if (message.type() === 'error') {
      issues.push(`console error: ${message.text()}`);
    }
  });

  page.on('pageerror', error => {
    issues.push(`page error: ${error.message}`);
  });

  page.on('requestfailed', request => {
    const url = request.url();
    if (url.startsWith('http://127.0.0.1:4174/')) {
      issues.push(`request failed: ${url} ${request.failure()?.errorText || ''}`.trim());
    }
  });

  return issues;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function activateFooterRoute(page: Page, href: string, heading: string) {
  const link = page.locator(`footer a[href="${href}"]`);
  await link.evaluate(element => {
    element.scrollIntoView({ block: 'center', inline: 'center' });
  });
  await expect(link).toBeVisible();
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(href)}$`));
  await expect(page.locator('h1')).toHaveText(heading);
}

async function openModule(page: Page, key: string) {
  const desktopLink = page.locator(`.app-shell-sidebar:not([data-mobile-sidebar="true"]) .app-shell-link[data-view="${key}"]`);
  if (await desktopLink.isVisible()) {
    await desktopLink.click();
    return;
  }

  await page.getByRole('button', { name: '打开导航' }).click();
  const drawerLink = page.locator(`.app-shell-mobile-drawer .app-shell-link[data-view="${key}"]`);
  await expect(drawerLink).toBeVisible();
  await drawerLink.click();
  await expect(page.locator('.app-shell-mobile-drawer')).toHaveCount(0);
}

async function expectActiveModule(page: Page, key: string, label: string) {
  const visibleActiveLink = page.locator(`.app-shell-link[data-view="${key}"][aria-current="page"]:visible`);
  if (await visibleActiveLink.count()) {
    await expect(visibleActiveLink.first()).toContainText(label);
    return;
  }

  await expect(page.locator('.app-shell-mobile-title')).toHaveText(label);
}

async function expectNoOverlap(page: Page, firstSelector: string, secondSelector: string, label: string) {
  const [firstBox, secondBox] = await Promise.all([
    page.locator(firstSelector).boundingBox(),
    page.locator(secondSelector).boundingBox()
  ]);
  expect(firstBox, `${label}: first element should be visible`).not.toBeNull();
  expect(secondBox, `${label}: second element should be visible`).not.toBeNull();
  if (!firstBox || !secondBox) {
    throw new Error(`${label}: expected both elements to be visible`);
  }
  const overlaps = !(
    firstBox.x + firstBox.width <= secondBox.x
    || secondBox.x + secondBox.width <= firstBox.x
    || firstBox.y + firstBox.height <= secondBox.y
    || secondBox.y + secondBox.height <= firstBox.y
  );
  expect(overlaps, label).toBe(false);
}

test.describe('release browser smoke', () => {
  const runtimeIssuesByPage = new WeakMap<Page, string[]>();

  test.beforeEach(async ({ page }) => {
    const runtimeIssues = installRuntimeGuards(page);
    runtimeIssuesByPage.set(page, runtimeIssues);
    await installOfflineFixtures(page);
  });

  test.afterEach(async ({ page }) => {
    expect(runtimeIssuesByPage.get(page) || []).toEqual([]);
  });

  test('covers calculator, products, orders, analytics, and footer routes', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator('main#main-content')).toBeVisible();

    await expect(page.locator('#view-calc')).toBeVisible();
    await expectActiveModule(page, 'calc', '利润计算器');
    await page.locator('#costNew').fill('20');
    await page.locator('#overseasShippingNew').fill('5');
    await expect(page.locator('#totalCostNew')).toHaveValue('25.00');
    await expect(page.locator('#tbodyV3')).toContainText('4折');
    await page.locator('#shippingMultiplierNew').fill('');
    await page.keyboard.type('1。1');
    await expect(page.locator('#shippingMultiplierNew')).toHaveValue('1.1');
    await page.locator('#shippingMultiplierNew').fill('');
    await page.keyboard.type('1..1');
    await expect(page.locator('#shippingMultiplierNew')).toHaveValue('1.1');
    await expect(page.locator('#shipFeeFormulaNew')).toContainText('运费倍率 1.10');
    const discountsInput = page.locator('#discountsNew');
    await discountsInput.fill('');
    await discountsInput.focus();
    const emptyDiscountSteps = [];
    for (const key of ['0', '.', '3', '5']) {
      await page.keyboard.type(key);
      emptyDiscountSteps.push(await discountsInput.evaluate(input => ({
        value: (input as HTMLInputElement).value,
        start: (input as HTMLInputElement).selectionStart,
        end: (input as HTMLInputElement).selectionEnd
      })));
    }
    expect(emptyDiscountSteps).toEqual([
      { value: '0', start: 1, end: 1 },
      { value: '0.', start: 2, end: 2 },
      { value: '0.3', start: 3, end: 3 },
      { value: '0.35', start: 4, end: 4 }
    ]);
    await discountsInput.fill('0.38,0.4,0.42');
    await discountsInput.evaluate(input => {
      const element = input as HTMLInputElement;
      element.focus();
      element.setSelectionRange(0, 0);
    });
    const prefixDiscountSteps = [];
    for (const key of ['0', '.', '3', '5']) {
      await page.keyboard.type(key);
      prefixDiscountSteps.push(await discountsInput.evaluate(input => ({
        value: (input as HTMLInputElement).value,
        start: (input as HTMLInputElement).selectionStart,
        end: (input as HTMLInputElement).selectionEnd
      })));
    }
    expect(prefixDiscountSteps).toEqual([
      { value: '00.38,0.4,0.42', start: 1, end: 1 },
      { value: '0.,0.38,0.4,0.42', start: 2, end: 2 },
      { value: '0.3,0.38,0.4,0.42', start: 3, end: 3 },
      { value: '0.35,0.38,0.4,0.42', start: 4, end: 4 }
    ]);
    expect(prefixDiscountSteps.at(-1)).toEqual({ value: '0.35,0.38,0.4,0.42', start: 4, end: 4 });
    const calcVisualState = await page.evaluate(() => {
      const cost = document.querySelector<HTMLInputElement>('#costNew');
      const total = document.querySelector<HTMLInputElement>('#totalCostNew');
      const cargo = document.querySelector<HTMLSelectElement>('#shipCargoTypeNew');
      const weight = document.querySelector<HTMLInputElement>('#shipActualWeightNew');
      const tabs = Array.from(document.querySelectorAll<HTMLElement>('.calc-tabs [data-calc-tab]'));
      const tableCell = document.querySelector<HTMLElement>('#tbodyV3 td');
      if (!cost || !total || !cargo || !weight || tabs.length < 2 || !tableCell) return null;
      const costStyle = getComputedStyle(cost);
      const totalStyle = getComputedStyle(total);
      const tabBoxes = tabs.map(tab => tab.getBoundingClientRect());
      const cellStyle = getComputedStyle(tableCell);
      return {
        costBackground: costStyle.backgroundImage || costStyle.backgroundColor,
        costHeight: cost.getBoundingClientRect().height,
        totalBackground: totalStyle.backgroundImage || totalStyle.backgroundColor,
        totalHeight: total.getBoundingClientRect().height,
        cargoHeight: cargo.getBoundingClientRect().height,
        weightHeight: weight.getBoundingClientRect().height,
        maxTabWidth: Math.max(...tabBoxes.map(box => box.width)),
        tabsSameLine: Math.max(...tabBoxes.map(box => Math.round(box.top))) === Math.min(...tabBoxes.map(box => Math.round(box.top))),
        tabsDoNotOverlap: tabBoxes
          .slice()
          .sort((a, b) => a.left - b.left)
          .every((box, index, boxes) => index === 0 || Math.round(box.left - boxes[index - 1].right) >= 0),
        tableCellBorderLeft: cellStyle.borderLeftWidth,
        tableCellBorderRight: cellStyle.borderRightWidth
      };
    });
    expect(calcVisualState).not.toBeNull();
    expect(calcVisualState?.costBackground).toContain('linear-gradient');
    expect(calcVisualState?.totalBackground).toContain('linear-gradient');
    expect(calcVisualState?.costHeight).toBeGreaterThanOrEqual(46);
    expect(calcVisualState?.costHeight).toBeLessThanOrEqual(50);
    expect(calcVisualState?.totalHeight).toBeGreaterThanOrEqual(46);
    expect(calcVisualState?.totalHeight).toBeLessThanOrEqual(50);
    expect(Math.abs((calcVisualState?.cargoHeight || 0) - (calcVisualState?.weightHeight || 0))).toBeLessThanOrEqual(1);
    expect(calcVisualState?.maxTabWidth).toBeLessThan(140);
    expect(calcVisualState?.tabsSameLine).toBe(true);
    expect(calcVisualState?.tabsDoNotOverlap).toBe(true);
    expect(calcVisualState?.tableCellBorderLeft).toBe('0px');
    expect(calcVisualState?.tableCellBorderRight).toBe('0px');

    await openModule(page, 'products');
    await expect(page.locator('#pl-main')).toBeVisible();
    await expectActiveModule(page, 'products', '商品管理');
    await expect(page.locator('.app-shell-link[data-view="calc"][aria-current="page"]:visible')).toHaveCount(0);
    await expect(page.locator('#pl-sync')).toContainText('云端已同步');
    await expect(page.locator('#pl-main .ot-header-status-row .left #pl-user')).toHaveCount(0);
    await expect(page.locator('#pl-main .ot-header-status-row .left #pl-sync')).toBeVisible();
    await expect(page.locator('#pl-main .ot-header-status-row .left #pl-refresh')).toBeVisible();
    await expect(page.locator('#pl-export')).toHaveCount(0);
    const productMainBackground = await page.locator('#pl-main').evaluate(element => getComputedStyle(element).backgroundColor);
    await expect(page.locator('#pl-refresh')).toHaveAttribute('aria-label', '刷新商品数据');
    await expect(page.locator('#pl-refresh')).toHaveText('');
    await expectNoOverlap(page, '#pl-sync', '#pl-refresh', 'product sync text and refresh button should not overlap');
    await expectNoOverlap(page, '#pl-acc-tabs', '#pl-add', 'product account tabs and add button should not overlap');
    await page.locator('#pl-add').click();
    await expect(page.locator('#pl-modal')).toBeVisible();
    await page.locator('#pl-account-select').selectOption('Test-Account');
    await page.locator('#pl-form [name="tkId"]').fill('TK-E2E-001');
    await page.locator('#pl-form [name="name"]').fill('E2E 测试雨衣');
    await page.locator('#pl-batch-weight').fill('150');
    await page.locator('#pl-batch-size').fill('30x25x15');
    await page.locator('#pl-sku-list [data-sku-field="skuName"]').fill('白 / S');
    await expect(page.locator('#pl-sku-list [data-sku-estimated-fee]').first()).toHaveText('¥ 34.81');
    await page.locator('#pl-form button[type="submit"]').click();
    await expect(page.locator('#pl-modal')).not.toBeVisible();
    await expect(page.locator('#pl-table-container')).toContainText('TK-E2E-001');
    const productTableMetrics = await page.locator('.products-react-table').evaluate(element => {
      const table = element.getBoundingClientRect();
      const container = document.querySelector('#pl-table-container')?.getBoundingClientRect();
      return {
        containerWidth: container?.width || 0,
        tableWidth: table.width
      };
    });
    expect(productTableMetrics.tableWidth).toBeGreaterThanOrEqual(Math.min(1100, productTableMetrics.containerWidth - 4));

    await page.locator('#pl-table-container button[data-edit="TK-E2E-001"]').click();
    await expect(page.locator('#pl-modal-title')).toHaveText('编辑商品');
    await page.locator('#pl-form [name="name"]').fill('E2E 测试雨衣 改');
    await page.locator('#pl-form button[type="submit"]').click();
    await expect(page.locator('#pl-table-container')).toContainText('E2E 测试雨衣 改');

    await openModule(page, 'orders');
    await expect(page.locator('#ot-main')).toBeVisible();
    await expect(page.locator('#ot-main')).toHaveCSS('background-color', productMainBackground);
    await expect(page.locator('#ot-sync')).toContainText('云端已同步');
    await page.locator('#ot-add').click();
    await expect(page.locator('#ot-modal')).toBeVisible();
    await page.locator('#ot-acc-select').selectOption('Test-Account');
    await page.locator('#ot-form [name="订单号"]').fill('ORDER-E2E-001');

    const itemRow = page.locator('#ot-item-list [data-line-id]').first();
    await itemRow.locator('[data-item-role="product-combobox"] [data-role="trigger"]').click();
    await itemRow.locator('[data-item-role="product-combobox"] [data-option-value="TK-E2E-001"]').click();
    await itemRow.locator('[data-item-role="sku-combobox"] [data-role="trigger"]').click();
    await itemRow.locator('[data-item-role="sku-combobox"] [data-option-value]').filter({ hasText: '白 / S' }).click();
    await itemRow.locator('[data-item-field="quantity"]').fill('02件');
    await expect(itemRow.locator('[data-item-field="quantity"]')).toHaveValue('2');
    await itemRow.locator('[data-item-field="trackingNo"]').fill('SF123456789CN');
    await page.locator('#ot-total-sale').fill('5000。5');
    await expect(page.locator('#ot-total-sale')).toHaveValue('5000.5');
    await page.locator('#ot-total-purchase').fill('40');
    await expect(page.locator('#ot-form [name="预估运费"]')).toHaveValue('34.81');
    await expect(page.locator('#ot-shipping-rule-preview')).toContainText('贴单 1.2');
    await page.locator('#ot-form button[type="submit"]').click();
    await expect(page.locator('#ot-table-container')).toContainText('ORDER-E2E-001');
    await expect(page.locator('#ot-table-container')).toContainText('顺丰快递');
    await expect(page.locator('#ot-summary-container .ot-summary-ledger-note').first()).toContainText(/销售 ¥/);
    await expect(page.locator('#ot-summary-container .ot-summary-ledger-note').nth(1)).toContainText(/采购 ¥.*运费 ¥.*达人/);
    await expect(page.locator('#ot-summary-container .ot-summary-ledger-note').first()).not.toHaveCSS('text-overflow', 'ellipsis');

    await page.locator('#ot-table-container button[data-edit]').first().click();
    await expect(page.locator('#ot-modal-title')).toHaveText('编辑订单');
    await expect(page.locator('#ot-form [name="预估运费"]')).toHaveValue('34.81');
    await expect(page.locator('#ot-shipping-rule-preview')).toContainText('贴单 1.2');
    await page.locator('#ot-form select[name="订单状态"]').selectOption('已采购');
    await page.locator('#ot-form button[type="submit"]').click();
    await expect(page.locator('#ot-table-container')).toContainText('已采购');

    await openModule(page, 'collection');
    await expect(page.locator('#view-collection')).toBeVisible();
    await expectActiveModule(page, 'collection', '商品采编');
    await expect(page.locator('[data-react-collection-page-ready="true"]')).toBeVisible();
    await expect(page.locator('#collection-sync')).toContainText('已同步');
    await expect(page.locator('#collection-export')).toHaveCount(0);
    await expect(page.locator('[data-app-topbar-connection]')).toContainText('已连接 · tk-e2e');
    await expect(page.locator('.collection-table')).toContainText('E2E 露营挂钩');
    await page.locator('#collection-search').fill('露营');
    await expect(page.locator('.collection-table')).toContainText('E2E 露营挂钩');
    await expect(page.locator('.collection-table')).toContainText('已采集');
    await expect(page.locator('.collection-table')).toContainText('露营收纳场景明确');
    await expect(page.locator('button').filter({ hasText: '导出当前表' })).toHaveCount(0);

    await openModule(page, 'analytics');
    await expect(page.locator('#view-analytics')).toBeVisible();
    await expect(page.locator('[data-app-topbar-connection]')).toContainText('已连接 · tk-e2e');
    await expect(page.locator('#analytics-acc-tabs')).toContainText('Test-Account');
    await page.locator('#analytics-acc-tabs').getByText('Test-Account').click();
    await page.locator('.analytics-file-picker').click();
    await expect(page.locator('#analytics-upload-account-modal')).toBeVisible();
    await expect(page.locator('#analytics-upload-account-select')).toHaveValue('Test-Account');
    const analyticsFileChooser = page.waitForEvent('filechooser');
    await page.locator('#analytics-upload-account-modal').getByRole('button', { name: '选择 Excel 文件' }).click();
    await (await analyticsFileChooser).setFiles({
      name: 'traffic.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('fake workbook')
    });
    await expect(page.locator('#analytics-file-meta')).toContainText('全部周期 · 1 张流量表 · 2 个商品');
    await expect(page.locator('#analytics-sync-status')).toContainText('已聚合全部周期');
    await expect(page.locator('#analytics-snapshot-select')).toContainText('全部周期');
    await expect(page.locator('[data-react-analytics-ready="true"]')).toBeVisible();
    await expect(page.locator('#analytics-kpi-grid')).toContainText('70,036 円');
    await expect(page.locator('#analytics-channel-share canvas')).toHaveCount(1);
    await expect(page.locator('#analytics-funnel')).toContainText('曝光');
    await expect(page.locator('#analytics-funnel')).toContainText('成交件数');
    await expect(page.locator('#analytics-bubble-chart canvas')).toHaveCount(1);
    await expect(page.locator('#analytics-channel-share')).toContainText('视频');
    await expect(page.locator('#analytics-action-plan')).toContainText('优先放大');
    await expect(page.evaluate(() => Object.keys(window.__tkE2eFirestoreStore.analytics_snapshots || {}).length)).resolves.toBeGreaterThan(0);
    await expect(page.evaluate(() => Object.keys(window.__tkE2eFirestoreStore.analytics_records || {}).length)).resolves.toBeGreaterThan(0);
    await expect(page.evaluate(() => Object.values(window.__tkE2eFirestoreStore.analytics_snapshots || {}).every((snapshot: any) => snapshot.accountName === 'Test-Account'))).resolves.toBe(true);

    await expect(page.locator('footer a[href="/privacy.html"]')).toHaveText('隐私与数据边界');
    await expect(page.locator('footer a[href="/terms.html"]')).toHaveText('使用条款');
    await activateFooterRoute(page, '/privacy.html', '隐私与数据边界');

    await page.goto('/');
    await activateFooterRoute(page, '/terms.html', '使用条款与免责声明');
  });

  test('keeps project connection stable and only signs out accounts', async ({ page }) => {
    const nativeDialogs = [];
    page.on('dialog', async dialog => {
      nativeDialogs.push(dialog.message());
      await dialog.dismiss();
    });

    await page.goto('/#orders');
    await expect(page.locator('#ot-main')).toBeVisible();
    await expect(page.locator('#ot-sync')).toContainText('云端已同步');

    await page.locator('[data-app-topbar-connection] button').click();
    await expect(page.getByRole('button', { name: '数据库管理' })).toBeVisible();
    await expect(page.getByRole('button', { name: '退出数据库' })).toHaveCount(0);
    await expect(page.locator('#app-firestore-disconnect-modal')).toHaveCount(0);
    expect(nativeDialogs).toEqual([]);

    await page.locator('[data-app-topbar-auth] button').click();
    await page.getByRole('button', { name: '退出登录' }).click();
    await expect(page.evaluate(() => JSON.parse(localStorage.getItem('tk.firestore.cfg.v1') || '{}').projectId)).resolves.toBe('tk-e2e');
    await expect(page.locator('#ot-main')).not.toBeVisible();
    await expect(page.locator('#view-login')).toBeVisible();
    await expect(page.locator('#view-login')).toContainText('项目登录');
    expect(nativeDialogs).toEqual([]);
  });

  test('serves privacy, terms, and 404 pages from the production preview', async ({ page }) => {
    await page.goto('/privacy.html');
    await expect(page.locator('h1')).toHaveText('隐私与数据边界');
    await expect(page.locator('main')).toContainText('你自己的 Firebase Firestore');
    await expect(page.locator('main')).toContainText('数据分析快照');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', '隐私与数据边界 · TK 电商工具箱');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');

    await page.goto('/terms.html');
    await expect(page.locator('h1')).toHaveText('使用条款与免责声明');
    await expect(page.locator('main')).toContainText('工具结果仅供参考');
    await expect(page.locator('main')).toContainText('用户自有数据责任');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', '使用条款与免责声明 · TK 电商工具箱');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');

    await page.goto('/404.html');
    await expect(page.locator('h1')).toHaveText('页面不存在');
    await expect(page.locator('a[href="/"]')).toHaveText('返回工具首页');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  });
});
