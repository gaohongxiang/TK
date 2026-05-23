import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormRow } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Toast } from '@/components/ui/toast';
import { useEffect, useState } from 'react';
import {
  initializeAuthSession,
  signOutAuthSession,
  subscribeAuthSession,
  type AuthSessionState
} from '../../auth-permissions.ts';
import { TKFirestoreConnection } from '../../firestore-connection.ts';

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
const modalCopyClass = 'text-[13px] leading-[1.75] text-[var(--muted)]';

function AppRuntime() {
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesMessage, setRulesMessage] = useState('当前 Firebase 项目的 Firestore 规则较旧，请重新复制并发布最新规则。');
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnectProject, setDisconnectProject] = useState('-');
  const [disconnectOptions, setDisconnectOptions] = useState<DisconnectOptions>({});
  const [configText, setConfigText] = useState('');
  const [authState, setAuthState] = useState<AuthSessionState>(() => ({
    ready: false,
    connected: false,
    projectId: '',
    user: null,
    member: null,
    isOwner: false,
    error: ''
  }));
  const [connectionLink, setConnectionLink] = useState('');
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
      const message = error instanceof Error ? error.message : '复制失败';
      showToast(message, 'error');
    } finally {
      setCopyingRules(false);
    }
  }

  function saveConnection() {
    try {
      const next = TKFirestoreConnection.saveConfig(configText);
      TKFirestoreConnection.dispatchConfigChanged({ connected: true, ...next });
      initializeAuthSession(next.configText);
      setConnectionOpen(false);
      showToast('已连接 Firebase');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '连接失败', 'error');
    }
  }

  function applyDisconnect() {
    TKFirestoreConnection.clearConfig();
    void signOutAuthSession();
    initializeAuthSession('');
    setDisconnectOpen(false);
    if (disconnectOptions.closeModal) setConnectionOpen(false);
  }

  async function copyConnectionLink() {
    try {
      const link = TKFirestoreConnection.createConnectionLink();
      await TKFirestoreConnection.copyText(link);
      setConnectionLink(link);
      showToast('成员连接链接已复制');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '生成连接链接失败', 'error');
    }
  }

  function applyConnectionLinkFromCurrentUrl() {
    try {
      const imported = TKFirestoreConnection.applyConnectionLinkFromLocation();
      if (!imported?.configText) return;
      refreshConfigText();
      initializeAuthSession(imported.configText);
      if (/connect=/.test(window.location.href)) {
        window.history.replaceState(null, '', '#login');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
      showToast('已导入连接配置');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '连接链接无效', 'error');
    }
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
      openMembers: () => {
        window.location.hash = '#permissions';
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
    applyConnectionLinkFromCurrentUrl();
    initializeAuthSession(TKFirestoreConnection.getConfig()?.configText || '');
    window.addEventListener('hashchange', applyConnectionLinkFromCurrentUrl);
    const unsubscribe = subscribeAuthSession(setAuthState);
    return () => {
      unsubscribe();
      window.removeEventListener('hashchange', applyConnectionLinkFromCurrentUrl);
      TKFirestoreConnection.registerUI(null);
      window.clearTimeout(toastTimer);
    };
  }, []);

  useEffect(() => {
    const handler = () => initializeAuthSession(TKFirestoreConnection.getConfig()?.configText || '');
    window.addEventListener('tk-firestore-config-changed', handler);
    return () => window.removeEventListener('tk-firestore-config-changed', handler);
  }, []);

  return (
    <div data-app-runtime-ready="true">
      <Dialog id="app-firestore-modal" open={connectionOpen} titleId="app-firestore-title" onOpenChange={setConnectionOpen}>
        <DialogContent className="max-w-[560px]">
          <DialogTitle id="app-firestore-title">连接 Firebase Firestore</DialogTitle>
          <Alert variant="info" className={modalCopyClass}>
            <AlertDescription>
            订单管理、商品管理和商品采编共用同一个 Firestore 项目。添加应用时选 <code>网页</code>，不用勾 Hosting；创建数据库时选 <code>区域级</code> 和
            <code>生产模式</code>。如果这个项目之前只发布过旧规则，请重新复制并发布最新 Firestore 规则，确保商品资料、订单资料和商品采编都可以正常保存。
            </AlertDescription>
          </Alert>
          <FormRow className="mt-[14px]">
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
          </FormRow>
          <div className="ot-setup-guide-actions mt-[10px]">
            <Button id="app-open-firebase-console" size="sm" onClick={() => TKFirestoreConnection.openConsole()}>打开 Firebase Console</Button>
            <Button id="app-copy-firestore-rules" size="sm" data-rules-url="docs/firebase/order-tracker-firestore.rules" disabled={copyingRules} onClick={() => void copyRules()}>
              {copyingRules ? '复制中…' : '复制 Firestore 规则'}
            </Button>
          </div>
          {TKFirestoreConnection.getConfig()?.projectId ? (
            <Alert variant="info" className={`${modalCopyClass} mt-[12px]`}>
              <AlertDescription>
                成员第一次用连接链接导入配置，之后直接打开工具箱即可；模块访问由登录账号和 Firestore 规则决定。
              </AlertDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => void copyConnectionLink()}>生成成员连接链接</Button>
                {connectionLink ? <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--muted)]">{connectionLink}</span> : null}
              </div>
            </Alert>
          ) : null}
          <DialogActions>
            <Button id="app-close-firestore-modal" onClick={() => setConnectionOpen(false)}>取消</Button>
            {TKFirestoreConnection.getConfig()?.projectId ? (
              <Button id="app-clear-firestore-config" variant="danger" onClick={() => TKFirestoreConnection.requestDisconnect({ closeModal: true })}>退出数据库</Button>
            ) : null}
            <Button id="app-save-firestore-config" variant="primary" onClick={saveConnection}>连接并开始使用</Button>
          </DialogActions>
        </DialogContent>
      </Dialog>

      <Dialog id="app-firestore-rules-modal" open={rulesOpen} titleId="app-firestore-rules-title" onOpenChange={setRulesOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogTitle id="app-firestore-rules-title">需要更新 Firestore 规则</DialogTitle>
          <Alert variant="warning" className={modalCopyClass} id="app-firestore-rules-copy">
            <AlertDescription>{rulesMessage}</AlertDescription>
          </Alert>
          <div className="ot-setup-guide-actions mt-[10px]">
            <Button id="app-rules-open-firebase-console" size="sm" onClick={() => TKFirestoreConnection.openConsole()}>打开 Firebase Console</Button>
            <Button id="app-rules-copy-firestore-rules" size="sm" disabled={copyingRules} onClick={() => void copyRules()}>{copyingRules ? '复制中…' : '复制 Firestore 规则'}</Button>
          </div>
          <DialogActions>
            <Button id="app-close-firestore-rules-modal" variant="primary" onClick={() => setRulesOpen(false)}>我知道了</Button>
          </DialogActions>
        </DialogContent>
      </Dialog>

      <Dialog id="app-firestore-disconnect-modal" open={disconnectOpen} titleId="app-firestore-disconnect-title" onOpenChange={setDisconnectOpen}>
        <DialogContent className="max-w-[460px]">
          <DialogTitle id="app-firestore-disconnect-title">退出当前数据库？</DialogTitle>
          <Alert variant="warning" className={modalCopyClass}>
            <AlertDescription>
              当前项目：<strong id="app-firestore-disconnect-project">{disconnectProject}</strong>。退出后只会清除本浏览器保存的 Firebase 连接配置，不会删除 Firestore 里的商品和订单。
            </AlertDescription>
          </Alert>
          <DialogActions>
            <Button id="app-cancel-firestore-disconnect" onClick={() => setDisconnectOpen(false)}>取消</Button>
            <Button id="app-confirm-firestore-disconnect" variant="danger" onClick={applyDisconnect}>退出数据库</Button>
          </DialogActions>
        </DialogContent>
      </Dialog>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </div>
  );
}

export { AppRuntime };
