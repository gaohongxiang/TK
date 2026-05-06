import { HelpCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

function OrdersPage() {
  return (
    <>
      <div className="module-hero page-hero page-hero-orders" data-react-orders-page-ready="true">
        <div className="module-hero-copy">
          <div className="module-hero-title-row">
            <h2>订单管理</h2>
            <div className="module-kicker">采购 / 物流 / 入仓进度</div>
          </div>
          <p>集中管理采购、物流和入仓进度，并汇总销售额、支出与预估利润。</p>
        </div>
      </div>

      <Card className="ot-setup" id="ot-setup">
        <div className="ot-empty">
          <div style={{ fontSize: 15, marginBottom: 6 }}>尚未连接 Firebase 数据源</div>
          <div style={{ fontSize: 12.5, marginBottom: 14 }}>
            订单管理和商品管理共用同一个 Firestore 项目。先连接一次，两个模块都会直接复用。
          </div>
          <Button id="ot-open-connection" variant="primary">连接 Firebase</Button>
        </div>
      </Card>

      <Card id="ot-main" style={{ display: 'none' }}>
        <div id="ot-header-status-row" className="ot-header-row ot-header-status-row">
          <div className="ot-bar">
            <div className="left">
              <span className="workspace-chip workspace-chip-connection" id="ot-user">未连接</span>
              <span className="sync workspace-chip workspace-chip-sync" id="ot-sync">就绪</span>
              <Button
                id="ot-refresh"
                variant="plain"
                className="calc-help-icon ot-refresh-inline"
                aria-label="刷新订单数据"
                title="刷新订单数据"
              >
                <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />
              </Button>
              <Button
                id="ot-storage-help-btn"
                variant="plain"
                className="calc-help-icon ot-storage-help-btn"
                aria-controls="ot-storage-help-modal"
                aria-haspopup="dialog"
                aria-label="数据存储说明"
                title="数据存储说明"
              >
                <HelpCircle size={15} strokeWidth={2} aria-hidden="true" />
              </Button>
            </div>
            <div className="right">
              <Button id="ot-export" size="sm">导出 CSV</Button>
              <Button id="ot-disconnect-firestore" size="sm" variant="danger" data-firestore-disconnect>退出数据库</Button>
            </div>
          </div>
        </div>

        <div id="ot-header-summary-row" className="ot-header-row ot-header-summary-row">
          <div id="ot-summary-container" />
        </div>
        <div id="ot-header-accounts-row" className="ot-header-row ot-header-accounts-row">
          <div className="ot-acc-tabs ot-acc-shell" id="ot-acc-tabs">
            <div className="ot-acc-tabs-all" id="ot-acc-tabs-all" />
            <div className="ot-acc-tabs-scroll" id="ot-acc-tabs-scroll">
              <button className="tab-add" id="ot-tab-add" title="添加账号" type="button">+</button>
            </div>
            <div className="ot-acc-actions" id="ot-acc-actions">
              <Button id="ot-add" variant="primary">+ 新增订单</Button>
            </div>
          </div>
        </div>
        <div id="ot-header-controls-row" className="ot-header-row ot-header-controls-row">
          <div id="ot-table-toolbar-container" />
        </div>
        <div className="ot-table-wrap">
          <div id="ot-table-container" />
        </div>
        <div id="ot-table-footer-toolbar-container" />
      </Card>
    </>
  );
}

export { OrdersPage };
