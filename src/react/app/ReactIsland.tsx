import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState } from 'react';
import { TKFirestoreConnection } from '../../firestore-connection.mjs';

type ToastType = 'ok' | 'error';
type ToastState = {
  message: string;
  type: ToastType;
  visible: boolean;
};

type DisconnectOptions = {
  closeModal?: boolean;
};

let toastTimer = 0;

function ReactIsland() {
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesMessage, setRulesMessage] = useState('当前 Firebase 项目的 Firestore 规则较旧，请重新复制并发布最新规则。');
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnectProject, setDisconnectProject] = useState('-');
  const [disconnectOptions, setDisconnectOptions] = useState<DisconnectOptions>({});
  const [configText, setConfigText] = useState('');
  const [copyingRules, setCopyingRules] = useState(false);
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'ok', visible: false });

  function refreshConfigText() {
    setConfigText(TKFirestoreConnection.getConfig()?.configText || '');
  }

  function showToast(message: string, type: ToastType = 'ok') {
    window.clearTimeout(toastTimer);
    setToast({ message, type, visible: true });
    toastTimer = window.setTimeout(() => {
      setToast(previous => ({ ...previous, visible: false }));
    }, 2500);
  }

  async function copyRules() {
    setCopyingRules(true);
    try {
      await TKFirestoreConnection.copyRules();
      showToast('规则已复制');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '复制失败', 'error');
    } finally {
      setCopyingRules(false);
    }
  }

  function saveConnection() {
    try {
      const next = TKFirestoreConnection.saveConfig(configText);
      TKFirestoreConnection.clearLegacyConfigs();
      TKFirestoreConnection.dispatchConfigChanged({ connected: true, ...next });
      setConnectionOpen(false);
      showToast('已连接 Firebase');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '连接失败', 'error');
    }
  }

  function applyDisconnect() {
    TKFirestoreConnection.clearConfig();
    setDisconnectOpen(false);
    if (disconnectOptions.closeModal) setConnectionOpen(false);
  }

  useEffect(() => {
    TKFirestoreConnection.registerUI({
      close: () => setConnectionOpen(false),
      closeDisconnectConfirm: () => setDisconnectOpen(false),
      closeRulesNotice: () => setRulesOpen(false),
      open: () => {
        refreshConfigText();
        setConnectionOpen(true);
      },
      notifyRulesUpdateNeeded: message => {
        setRulesMessage(String(message || '').trim() || '当前 Firebase 项目的 Firestore 规则较旧，请重新复制并发布最新规则。');
        setRulesOpen(true);
      },
      requestDisconnect: options => {
        const cfg = TKFirestoreConnection.getConfig();
        if (!cfg?.projectId) return false;
        setDisconnectOptions(options || {});
        setDisconnectProject(cfg.projectId);
        setDisconnectOpen(true);
        return true;
      },
      showToast
    });
    refreshConfigText();
    return () => {
      TKFirestoreConnection.registerUI(null);
      window.clearTimeout(toastTimer);
    };
  }, []);

  return (
    <div data-react-island-ready="true">
      <Dialog id="app-firestore-modal" open={connectionOpen} titleId="app-firestore-title" onOpenChange={setConnectionOpen}>
        <DialogContent style={{ maxWidth: 560 }}>
          <DialogTitle id="app-firestore-title">连接 Firebase Firestore</DialogTitle>
          <Alert variant="info" className="modal-copy">
            <AlertDescription>
            订单管理和商品管理共用同一个 Firestore 项目。添加应用时选 <code>网页</code>，不用勾 Hosting；创建数据库时选 <code>区域级</code> 和
            <code>生产模式</code>。如果这个项目之前只发布过旧规则，请重新复制并发布最新 Firestore 规则，把
            <code>orders</code>、<code>order_accounts</code>、<code>sync_state</code> 和 <code>products</code> 一并放行。
            </AlertDescription>
          </Alert>
          <div className="row" style={{ marginTop: 14 }}>
            <FormField htmlFor="app-firestore-config" label="Firebase config" full>
              <Textarea
                id="app-firestore-config"
                rows={8}
                placeholder={`{
  "apiKey": "AIza...",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "appId": "1:1234567890:web:abcdef"
}`}
                autoComplete="off"
                value={configText}
                onChange={event => setConfigText(event.target.value)}
              />
            </FormField>
          </div>
          <div className="ot-setup-guide-actions" style={{ marginTop: 10 }}>
            <Button id="app-open-firebase-console" size="sm" onClick={() => TKFirestoreConnection.openConsole()}>打开 Firebase Console</Button>
            <Button id="app-copy-firestore-rules" size="sm" data-rules-url="docs/firebase/order-tracker-firestore.rules" disabled={copyingRules} onClick={() => void copyRules()}>
              {copyingRules ? '复制中…' : '复制 Firestore 规则'}
            </Button>
          </div>
          <div className="actions">
            <Button id="app-close-firestore-modal" onClick={() => setConnectionOpen(false)}>取消</Button>
            <Button id="app-clear-firestore-config" variant="danger" style={{ display: TKFirestoreConnection.getConfig()?.projectId ? undefined : 'none' }} onClick={() => TKFirestoreConnection.requestDisconnect({ closeModal: true })}>退出数据库</Button>
            <Button id="app-save-firestore-config" variant="primary" onClick={saveConnection}>连接并开始使用</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog id="app-firestore-rules-modal" open={rulesOpen} titleId="app-firestore-rules-title" onOpenChange={setRulesOpen}>
        <DialogContent style={{ maxWidth: 520 }}>
          <DialogTitle id="app-firestore-rules-title">需要更新 Firestore 规则</DialogTitle>
          <Alert variant="warning" className="modal-copy" id="app-firestore-rules-copy">
            <AlertDescription>{rulesMessage}</AlertDescription>
          </Alert>
          <div className="ot-setup-guide-actions" style={{ marginTop: 10 }}>
            <Button id="app-rules-open-firebase-console" size="sm" onClick={() => TKFirestoreConnection.openConsole()}>打开 Firebase Console</Button>
            <Button id="app-rules-copy-firestore-rules" size="sm" disabled={copyingRules} onClick={() => void copyRules()}>{copyingRules ? '复制中…' : '复制 Firestore 规则'}</Button>
          </div>
          <div className="actions">
            <Button id="app-close-firestore-rules-modal" variant="primary" onClick={() => setRulesOpen(false)}>我知道了</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog id="app-firestore-disconnect-modal" open={disconnectOpen} titleId="app-firestore-disconnect-title" onOpenChange={setDisconnectOpen}>
        <DialogContent style={{ maxWidth: 460 }}>
          <DialogTitle id="app-firestore-disconnect-title">退出当前数据库？</DialogTitle>
          <Alert variant="warning" className="modal-copy">
            <AlertDescription>
              当前项目：<strong id="app-firestore-disconnect-project">{disconnectProject}</strong>。退出后只会清除本浏览器保存的 Firebase 连接配置，不会删除 Firestore 里的商品和订单。
            </AlertDescription>
          </Alert>
          <div className="actions">
            <Button id="app-cancel-firestore-disconnect" onClick={() => setDisconnectOpen(false)}>取消</Button>
            <Button id="app-confirm-firestore-disconnect" variant="danger" onClick={applyDisconnect}>退出数据库</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div
        id="toast"
        data-slot="toast"
        className={`fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-[10px] border bg-[var(--panel)] px-[18px] py-2.5 text-[13px] shadow-[var(--shadow)] ${toast.visible ? 'show block' : 'hidden'} ${toast.type === 'error' ? 'border-[var(--danger)] text-[var(--danger)]' : 'border-[var(--ok)] text-[var(--ok)]'}`}
      >
        {toast.message}
      </div>
    </div>
  );
}

export { ReactIsland };
