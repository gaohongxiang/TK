import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

function ProductsPage() {
  return (
    <>
      <div className="module-hero page-hero page-hero-products" data-react-products-page-ready="true">
        <div className="module-hero-copy">
          <div className="module-hero-title-row">
            <h2>商品管理</h2>
            <div className="module-kicker">商品资料 / 预估运费 / 采购链接</div>
          </div>
          <p>沉淀商品资料、预估运费和采购链接，录一次基础资料，后续订单直接复用。</p>
        </div>
      </div>

      <Card className="ot-setup" id="pl-disconnected">
        <div className="ot-empty">
          <div style={{ fontSize: 15, marginBottom: 6 }}>尚未连接 Firebase 数据源</div>
          <div style={{ fontSize: 12.5, marginBottom: 14 }}>
            商品管理和订单管理共用同一个 Firestore 项目。先连接一次，两个模块都会直接复用。
          </div>
          <Button id="pl-open-connection" variant="primary">连接 Firebase</Button>
        </div>
      </Card>

      <Card id="pl-main" style={{ display: 'none' }}>
        <div className="ot-header-row">
          <div className="ot-bar">
            <div className="left">
              <span className="workspace-chip workspace-chip-connection" id="pl-user">未连接</span>
              <span className="sync workspace-chip workspace-chip-sync" id="pl-sync">未连接</span>
              <Button
                id="pl-refresh"
                variant="plain"
                className="calc-help-icon ot-refresh-inline"
                aria-label="刷新商品管理数据"
                title="刷新商品管理数据"
              >
                <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />
              </Button>
            </div>
            <div className="right">
              <Button id="pl-export" size="sm">导出 CSV</Button>
              <Button id="pl-disconnect-firestore" size="sm" variant="danger" data-firestore-disconnect>退出数据库</Button>
            </div>
          </div>
        </div>
        <div className="ot-header-row ot-header-accounts-row">
          <div className="ot-acc-tabs ot-acc-shell" id="pl-acc-tabs">
            <div className="ot-acc-tabs-all" id="pl-acc-tabs-all" />
            <div className="ot-acc-tabs-scroll" id="pl-acc-tabs-scroll" />
            <div className="ot-acc-actions" id="pl-acc-actions">
              <Button id="pl-add" variant="primary">+ 新增商品</Button>
            </div>
          </div>
        </div>
        <div id="pl-toolbar" />
        <div className="ot-table-wrap">
          <div id="pl-table-container" />
        </div>
        <div id="pl-table-footer-toolbar-container" />
      </Card>
    </>
  );
}

export { ProductsPage };
