const { test, expect } = require('@playwright/test');

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

async function installOfflineFixtures(page) {
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
      }
    };

    function clone(value) {
      return JSON.parse(JSON.stringify(value ?? null));
    }

    function collectionStore(name) {
      if (!window.__tkE2eFirestoreStore[name]) window.__tkE2eFirestoreStore[name] = {};
      return window.__tkE2eFirestoreStore[name];
    }

    function makeDocRef(collectionName, id) {
      return {
        id,
        async set(data, options = {}) {
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

    function makeCollectionRef(collectionName) {
      const ref = {
        doc(id) {
          return makeDocRef(collectionName, String(id || '').trim());
        },
        orderBy() {
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
          set(ref, data, options) {
            operations.push(() => ref.set(data, options));
          },
          delete(ref) {
            operations.push(() => ref.delete());
          },
          async commit() {
            for (const apply of operations) await apply();
          }
        };
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
          firestore: () => db
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

function installRuntimeGuards(page) {
  const issues = [];

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

async function activateFooterRoute(page, href, heading) {
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

test.describe('release browser smoke', () => {
  test.beforeEach(async ({ page }) => {
    const runtimeIssues = installRuntimeGuards(page);
    page.__tkRuntimeIssues = runtimeIssues;
    await installOfflineFixtures(page);
  });

  test.afterEach(async ({ page }) => {
    expect(page.__tkRuntimeIssues || []).toEqual([]);
  });

  test('covers calculator, products, orders, analytics, and footer routes', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator('main#main-content')).toBeVisible();

    await expect(page.locator('#view-calc')).toBeVisible();
    await expect(page.locator('nav.modules a.active')).toHaveText('利润计算器');
    await expect(page.locator('nav.modules a[data-view="calc"]')).toHaveAttribute('aria-current', 'page');
    await page.locator('#costNew').fill('20');
    await page.locator('#overseasShippingNew').fill('5');
    await expect(page.locator('#totalCostNew')).toHaveValue('25.00');
    await expect(page.locator('#tbodyNew')).toContainText('4折');

    await page.locator('nav.modules a[data-view="products"]').click();
    await expect(page.locator('#pl-main')).toBeVisible();
    await expect(page.locator('nav.modules a[data-view="products"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('nav.modules a[data-view="calc"]')).not.toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#pl-sync')).toContainText('已同步');
    await page.locator('#pl-add').click();
    await expect(page.locator('#pl-modal')).toHaveClass(/show/);
    await page.locator('#pl-account-select').selectOption('Test-Account');
    await page.locator('#pl-form [name="tkId"]').fill('TK-E2E-001');
    await page.locator('#pl-form [name="name"]').fill('E2E 测试雨衣');
    await page.locator('#pl-batch-weight').fill('320');
    await page.locator('#pl-batch-size').fill('20x15x10');
    await page.locator('#pl-sku-list [data-sku-field="skuName"]').fill('白 / S');
    await page.locator('#pl-form button[type="submit"]').click();
    await expect(page.locator('#pl-modal')).not.toHaveClass(/show/);
    await expect(page.locator('#pl-table-container')).toContainText('TK-E2E-001');

    await page.locator('#pl-table-container button[data-edit="TK-E2E-001"]').click();
    await expect(page.locator('#pl-modal-title')).toHaveText('编辑商品');
    await page.locator('#pl-form [name="name"]').fill('E2E 测试雨衣 改');
    await page.locator('#pl-form button[type="submit"]').click();
    await expect(page.locator('#pl-table-container')).toContainText('E2E 测试雨衣 改');

    await page.locator('nav.modules a[data-view="orders"]').click();
    await expect(page.locator('#ot-main')).toBeVisible();
    await expect(page.locator('#ot-sync')).toContainText('已同步');
    await page.locator('#ot-add').click();
    await expect(page.locator('#ot-modal')).toHaveClass(/show/);
    await page.locator('#ot-acc-select').selectOption('Test-Account');
    await page.locator('#ot-form [name="订单号"]').fill('ORDER-E2E-001');

    const itemRow = page.locator('#ot-item-list [data-line-id]').first();
    await itemRow.locator('[data-item-role="product-combobox"] [data-role="trigger"]').click();
    await itemRow.locator('[data-item-role="product-combobox"] [data-option-value="TK-E2E-001"]').click();
    await itemRow.locator('[data-item-role="sku-combobox"] [data-role="trigger"]').click();
    await itemRow.locator('[data-item-role="sku-combobox"] [data-option-value]').filter({ hasText: '白 / S' }).click();
    await itemRow.locator('[data-item-field="quantity"]').fill('2');
    await itemRow.locator('[data-item-field="trackingNo"]').fill('SF123456789CN');
    await page.locator('#ot-total-sale').fill('5000');
    await page.locator('#ot-total-purchase').fill('40');
    await page.locator('#ot-form [name="预估运费"]').fill('12');
    await page.locator('#ot-form button[type="submit"]').click();
    await expect(page.locator('#ot-table-container')).toContainText('ORDER-E2E-001');
    await expect(page.locator('#ot-table-container')).toContainText('顺丰快递');

    await page.locator('#ot-table-container button[data-edit]').first().click();
    await expect(page.locator('#ot-modal-title')).toHaveText('编辑订单');
    await page.locator('#ot-form select[name="订单状态"]').selectOption('已采购');
    await page.locator('#ot-form button[type="submit"]').click();
    await expect(page.locator('#ot-table-container')).toContainText('已采购');

    await page.locator('nav.modules a[data-view="analytics"]').click();
    await expect(page.locator('#view-analytics')).toBeVisible();
    await page.locator('#analytics-file-input').setInputFiles({
      name: 'traffic.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('fake workbook')
    });
    await expect(page.locator('#analytics-file-meta')).toContainText('traffic.xlsx');
    await expect(page.locator('#analytics-kpi-grid')).toContainText('70,036 円');
    await expect(page.locator('#analytics-diagnostics')).toContainText('爆品放大');

    await expect(page.locator('footer a[href="/privacy.html"]')).toHaveText('隐私与数据边界');
    await expect(page.locator('footer a[href="/terms.html"]')).toHaveText('使用条款');
    await activateFooterRoute(page, '/privacy.html', '隐私与数据边界');

    await page.goto('/');
    await activateFooterRoute(page, '/terms.html', '使用条款与免责声明');
  });

  test('serves privacy, terms, and 404 pages from the production preview', async ({ page }) => {
    await page.goto('/privacy.html');
    await expect(page.locator('h1')).toHaveText('隐私与数据边界');
    await expect(page.locator('main')).toContainText('你自己的 Firebase Firestore');
    await expect(page.locator('main')).toContainText('当前浏览器内存');
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
