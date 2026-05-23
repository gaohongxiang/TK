import { Check, Copy, ExternalLink, KeyRound, Plus, Settings2, ShieldCheck, Trash2, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, FormRow } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ALL_PERMISSION_MODULES,
  createStaffMember,
  deleteMember,
  getAuthErrorMessage,
  listMembers,
  saveMember,
  subscribeAuthSession,
  type AuthSessionState,
  type MemberProfile,
  type ModulePermissionKey
} from '../../../auth-permissions.ts';
import { TKFirestoreConnection } from '../../../firestore-connection.ts';
import { cn } from '@/lib/utils';

type AdminPageProps = {
  active?: boolean;
};
type BulkPermissionMode = 'append' | 'remove' | 'replace';

const moduleLabels: Record<ModulePermissionKey, string> = {
  products: '商品管理',
  orders: '订单管理',
  finance: '收支管理',
  collection: '商品采编',
  analytics: '数据分析'
};

const adminPageShellClass = 'admin-page grid gap-4';
const adminHeroClass = 'rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel2)_60%,white),var(--panel))] p-5 shadow-[var(--shadow)]';
const adminHeroTitleClass = 'mb-2 mt-0 flex items-center gap-2 text-[22px] font-semibold tracking-normal text-[var(--text)] max-[640px]:text-[19px]';
const adminHeroCopyClass = 'm-0 max-w-[780px] text-[13px] leading-[1.7] text-[var(--muted)]';
const adminToolbarClass = 'flex flex-wrap items-center justify-between gap-2';
const adminProjectBadgeClass = 'inline-flex min-h-[30px] items-center rounded-full border border-[var(--border)] bg-[var(--panel2)] px-3 text-[12px] font-semibold text-[var(--text)]';
const adminCardTitleClass = 'mb-0 normal-case tracking-normal text-[14px] text-[var(--text)]';
const adminFormClass = 'grid gap-3';
const adminListClass = 'grid gap-2';
const adminMemberRowClass = 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--panel2)] px-3 py-2.5 max-[760px]:grid-cols-1 max-[760px]:items-start';
const adminMemberNameClass = 'min-w-0';
const adminMemberEmailClass = 'block truncate text-[13.5px] font-semibold text-[var(--text)]';
const adminMemberMetaClass = 'mt-1 block text-[11.5px] text-[var(--muted)]';
const adminMemberRoleClass = 'inline-flex min-h-[26px] items-center rounded-full border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[11.5px] font-semibold text-[var(--muted)]';
const adminGridClass = 'grid grid-cols-[260px_minmax(0,1fr)] gap-4 max-[880px]:grid-cols-1';
const adminSideListClass = 'grid gap-2';
const adminSideItemClass = 'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--panel2)] px-3 text-left text-[13px] text-[var(--muted)] transition-[border-color,background,color] hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:text-[var(--text)]';
const adminSideItemActiveClass = 'border-[color-mix(in_srgb,var(--accent)_42%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel))] text-[var(--text)]';
const permissionGridClass = 'grid grid-cols-2 gap-2 max-[640px]:grid-cols-1';
const permissionItemClass = 'flex min-h-[48px] items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--panel2)] px-3 text-[13px] text-[var(--text)]';
const permissionCheckboxClass = 'h-[18px] w-[18px] accent-[var(--accent)]';
const permissionHeaderActionsClass = 'flex flex-wrap items-center justify-end gap-2';
const permissionDirtyBadgeClass = 'inline-flex min-h-[26px] items-center rounded-full border border-[color-mix(in_srgb,var(--warn)_36%,var(--border))] bg-[color-mix(in_srgb,var(--warn)_10%,var(--panel))] px-2.5 text-[11.5px] font-semibold text-[color-mix(in_srgb,var(--warn)_70%,var(--text))]';
const permissionSavedBadgeClass = 'inline-flex min-h-[26px] items-center rounded-full border border-[color-mix(in_srgb,var(--ok)_30%,var(--border))] bg-[color-mix(in_srgb,var(--ok)_8%,var(--panel))] px-2.5 text-[11.5px] font-semibold text-[color-mix(in_srgb,var(--ok)_76%,var(--text))]';
const bulkPermissionPanelClass = 'grid gap-3 rounded-[16px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--panel2)_48%,transparent)] p-4';
const bulkPermissionGridClass = 'grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] gap-3 max-[900px]:grid-cols-1';
const bulkMemberGridClass = 'grid max-h-[210px] gap-2 overflow-auto pr-1';
const bulkModuleGridClass = 'grid grid-cols-3 gap-2 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1';
const bulkChoiceClass = 'flex min-h-[38px] items-center gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--panel)] px-3 text-[12.5px] text-[var(--text)]';
const bulkActionsClass = 'flex flex-wrap items-center justify-between gap-2';
const bulkModeClass = 'flex flex-wrap gap-2';
const bulkModeButtonClass = 'rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-semibold text-[var(--muted)] transition-[border-color,background,color]';
const bulkModeButtonActiveClass = 'border-[color-mix(in_srgb,var(--accent)_42%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel))] text-[var(--accent)]';
const emptyClass = 'm-0 rounded-[12px] border border-dashed border-[var(--border)] bg-[color-mix(in_srgb,var(--panel2)_42%,transparent)] px-3 py-5 text-center text-[12.5px] text-[var(--muted)]';
const settingsGridClass = 'grid grid-cols-3 gap-3 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1';
const settingsInfoClass = 'rounded-[14px] border border-[var(--border)] bg-[var(--panel2)] px-3 py-3';
const settingsLabelClass = 'mb-1 text-[11.5px] font-semibold text-[var(--muted)]';
const settingsValueClass = 'truncate text-[13px] font-semibold text-[var(--text)]';
const settingsTextareaClass = 'max-h-[220px] min-h-[120px] overflow-auto font-mono text-[12px] leading-[1.5]';
const settingsCodeBoxClass = 'max-h-[260px] overflow-auto whitespace-pre rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--panel2)_56%,transparent)] p-3 font-mono text-[11.5px] leading-[1.55] text-[var(--text)]';
const settingsSectionCopyClass = 'm-0 text-[12px] leading-[1.65] text-[var(--muted)]';

function normalizePermissionModules(modules: ModulePermissionKey[]) {
  const selected = new Set(modules);
  return ALL_PERMISSION_MODULES.filter(moduleKey => selected.has(moduleKey));
}

function isSamePermissionModules(left: ModulePermissionKey[], right: ModulePermissionKey[]) {
  const normalizedLeft = normalizePermissionModules(left);
  const normalizedRight = normalizePermissionModules(right);
  return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((moduleKey, index) => moduleKey === normalizedRight[index]);
}

function applyBulkPermissionMode(currentModules: ModulePermissionKey[], pickedModules: ModulePermissionKey[], mode: BulkPermissionMode) {
  if (mode === 'replace') return normalizePermissionModules(pickedModules);
  const current = new Set(currentModules);
  if (mode === 'remove') pickedModules.forEach(moduleKey => current.delete(moduleKey));
  else pickedModules.forEach(moduleKey => current.add(moduleKey));
  return normalizePermissionModules(Array.from(current) as ModulePermissionKey[]);
}

function useAdminMembers(active = true) {
  const [authState, setAuthState] = useState<AuthSessionState>(() => ({
    ready: false,
    connected: false,
    projectId: '',
    user: null,
    member: null,
    isOwner: false,
    error: ''
  }));
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refreshMembers() {
    if (!authState.isOwner) return;
    setBusy(true);
    setError('');
    try {
      setMembers(await listMembers());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取成员失败');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => subscribeAuthSession(setAuthState), []);

  useEffect(() => {
    if (!active || !authState.isOwner) return;
    void refreshMembers();
  }, [active, authState.isOwner]);

  return {
    authState,
    busy,
    error,
    members,
    refreshMembers,
    setBusy,
    setError,
    setMembers
  };
}

function AdminPageFrame({
  active,
  children,
  copy,
  icon,
  title
}: {
  active?: boolean;
  children: React.ReactNode;
  copy: string;
  icon: React.ReactNode;
  title: string;
}) {
  if (!active) return null;
  return (
    <section className={adminPageShellClass} data-admin-page-ready="true">
      <div className={adminHeroClass}>
        <h2 className={adminHeroTitleClass}>{icon}{title}</h2>
        <p className={adminHeroCopyClass}>{copy}</p>
      </div>
      {children}
    </section>
  );
}

function AccountManagementPage({ active = true }: AdminPageProps) {
  const { authState, busy, error, members, refreshMembers, setBusy, setError } = useAdminMembers(active);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [copiedLink, setCopiedLink] = useState('');

  async function createMember() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await createStaffMember(email, password, []);
      setEmail('');
      setPassword('');
      await refreshMembers();
      TKFirestoreConnection.showToast('员工账号已创建');
    } catch (createError) {
      setError(getAuthErrorMessage(createError, '员工账号创建失败'));
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(emailToRemove: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteMember(emailToRemove);
      await refreshMembers();
      TKFirestoreConnection.showToast('账号已移除');
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '账号移除失败');
    } finally {
      setBusy(false);
    }
  }

  async function copyConnectionLink() {
    try {
      const link = TKFirestoreConnection.createConnectionLink();
      await TKFirestoreConnection.copyText(link);
      setCopiedLink(link);
      TKFirestoreConnection.showToast('成员连接链接已复制');
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : '连接链接复制失败');
    }
  }

  return (
    <AdminPageFrame
      active={active}
      icon={<UsersRound size={22} strokeWidth={2.2} aria-hidden="true" />}
      title="账号管理"
      copy="创建和移除员工登录账号。新账号默认没有业务模块权限，创建后到权限管理里勾选可访问模块。"
    >
      <div className={adminToolbarClass}>
        <span className={adminProjectBadgeClass}>项目：{authState.projectId || TKFirestoreConnection.getConfig()?.projectId || '-'}</span>
        <Button size="sm" onClick={() => void copyConnectionLink()}><Copy aria-hidden="true" />复制成员连接链接</Button>
      </div>

      {error ? (
        <Alert variant="danger" className="text-[12.5px]">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className={adminCardTitleClass}><Plus size={15} strokeWidth={2} aria-hidden="true" />新增员工账号</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={adminFormClass}>
            <FormRow columns={3}>
              <FormField label="员工邮箱" htmlFor="admin-account-email">
                <Input id="admin-account-email" type="email" value={email} placeholder="name@example.com" autoComplete="off" onChange={event => setEmail(event.target.value)} />
              </FormField>
              <FormField label="初始密码" htmlFor="admin-account-password">
                <Input id="admin-account-password" type="password" value={password} placeholder="至少 6 位" autoComplete="new-password" onChange={event => setPassword(event.target.value)} />
              </FormField>
              <FormField label=" " className="justify-end">
                <Button id="admin-account-create" variant="primary" className="min-h-10" disabled={busy || !email.trim() || !password} onClick={() => void createMember()}>
                  <KeyRound aria-hidden="true" />
                  创建账号
                </Button>
              </FormField>
            </FormRow>
            <p className="m-0 text-[12px] text-[var(--muted)]">员工用成员连接链接导入项目，再用这里创建的邮箱和初始密码登录。忘记密码时，回到项目登录页点击“忘记密码”处理。</p>
            {copiedLink ? <p className="m-0 truncate text-[11.5px] text-[var(--muted)]">{copiedLink}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={adminCardTitleClass}><UserRound size={15} strokeWidth={2} aria-hidden="true" />账号列表</CardTitle>
          <Button size="sm" onClick={() => void refreshMembers()} disabled={busy}>刷新</Button>
        </CardHeader>
        <CardContent>
          <div className={adminListClass}>
            {members.map(member => (
              <div className={adminMemberRowClass} key={member.email}>
                <div className={adminMemberNameClass}>
                  <span className={adminMemberEmailClass}>{member.email}</span>
                  <span className={adminMemberMetaClass}>{member.role === 'owner' ? '管理员账号' : `业务权限 ${member.modules.length} 个`}</span>
                </div>
                <span className={adminMemberRoleClass}>{member.role === 'owner' ? '管理员' : '员工'}</span>
                {member.role === 'owner' ? null : (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => void removeMember(member.email)}>
                      <Trash2 aria-hidden="true" />
                      移除
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {!members.length ? <p className={emptyClass}>{busy ? '正在读取账号...' : '暂无账号'}</p> : null}
          </div>
        </CardContent>
      </Card>
    </AdminPageFrame>
  );
}

function PermissionManagementPage({ active = true }: AdminPageProps) {
  const { busy, error, members, refreshMembers, setBusy, setError, setMembers } = useAdminMembers(active);
  const editableMembers = useMemo(() => members.filter(member => member.role !== 'owner'), [members]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const selectedMember = editableMembers.find(member => member.email === selectedEmail) || editableMembers[0] || null;
  const selectedSavedModules = selectedMember?.modules || [];
  const selectedSavedModuleKey = selectedSavedModules.join('|');
  const [draftModules, setDraftModules] = useState<ModulePermissionKey[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [bulkMode, setBulkMode] = useState<BulkPermissionMode>('append');
  const [bulkMemberEmails, setBulkMemberEmails] = useState<string[]>([]);
  const [bulkModules, setBulkModules] = useState<ModulePermissionKey[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const permissionsDirty = selectedMember ? !isSamePermissionModules(draftModules, selectedSavedModules) : false;

  useEffect(() => {
    if (!active) return;
    if (!editableMembers.length) {
      setSelectedEmail('');
      return;
    }
    if (!editableMembers.some(member => member.email === selectedEmail)) {
      setSelectedEmail(editableMembers[0].email);
    }
  }, [active, editableMembers, selectedEmail]);

  useEffect(() => {
    setDraftModules(normalizePermissionModules(selectedSavedModules));
  }, [selectedMember?.email, selectedSavedModuleKey]);

  useEffect(() => {
    setBulkMemberEmails(current => current.filter(email => editableMembers.some(member => member.email === email)));
  }, [editableMembers]);

  function toggleModule(moduleKey: ModulePermissionKey) {
    if (!selectedMember || savingPermissions) return;
    setDraftModules(current => {
      const nextModules = current.includes(moduleKey)
        ? current.filter(item => item !== moduleKey)
        : [...current, moduleKey];
      return normalizePermissionModules(nextModules);
    });
  }

  function resetDraftModules() {
    setDraftModules(normalizePermissionModules(selectedSavedModules));
  }

  function toggleBulkMember(email: string) {
    setBulkMemberEmails(current => current.includes(email) ? current.filter(item => item !== email) : [...current, email]);
  }

  function toggleBulkModule(moduleKey: ModulePermissionKey) {
    setBulkModules(current => normalizePermissionModules(current.includes(moduleKey) ? current.filter(item => item !== moduleKey) : [...current, moduleKey]));
  }

  async function applyBulkPermissions() {
    if (bulkSaving || !bulkMemberEmails.length || !bulkModules.length) return;
    const selectedEmails = new Set(bulkMemberEmails);
    const targets = editableMembers.filter(member => selectedEmails.has(member.email));
    setBulkSaving(true);
    setError('');
    try {
      const updates = targets.map(member => {
        const nextModules = applyBulkPermissionMode(member.modules, bulkModules, bulkMode);
        return saveMember(member.email, nextModules, 'staff').then(() => ({ email: member.email, modules: nextModules }));
      });
      const updated = await Promise.all(updates);
      const updatedMap = new Map(updated.map(item => [item.email, item.modules]));
      setMembers(current => current.map(member => updatedMap.has(member.email) ? { ...member, modules: updatedMap.get(member.email) || [] } : member));
      setDraftModules(current => selectedMember && updatedMap.has(selectedMember.email) ? updatedMap.get(selectedMember.email) || [] : current);
      TKFirestoreConnection.showToast(`已更新 ${updated.length} 个员工权限`);
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : '批量权限保存失败');
    } finally {
      setBulkSaving(false);
    }
  }

  async function savePermissions() {
    if (!selectedMember || savingPermissions || !permissionsDirty) return;
    const nextModules = normalizePermissionModules(draftModules);
    setSavingPermissions(true);
    setError('');
    try {
      await saveMember(selectedMember.email, nextModules, 'staff');
      setMembers(current => current.map(member => member.email === selectedMember.email ? { ...member, modules: nextModules } : member));
      setDraftModules(nextModules);
      TKFirestoreConnection.showToast('权限已保存');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '权限保存失败');
    } finally {
      setSavingPermissions(false);
    }
  }

  return (
    <AdminPageFrame
      active={active}
      icon={<ShieldCheck size={22} strokeWidth={2.2} aria-hidden="true" />}
      title="权限管理"
      copy="选择一个员工账号，然后勾选这个账号能访问的业务模块。管理员账号默认拥有全部权限，不在这里编辑。"
    >
      {error ? (
        <Alert variant="danger" className="text-[12.5px]">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className={adminCardTitleClass}>批量修改权限</CardTitle>
          <span className={adminMemberRoleClass}>{bulkMemberEmails.length} 个员工</span>
        </CardHeader>
        <CardContent>
          <div className={bulkPermissionPanelClass}>
            <div className={bulkPermissionGridClass}>
              <div className={adminFormClass}>
                <div className={bulkActionsClass}>
                  <span className="text-[12px] font-semibold text-[var(--muted)]">选择员工</span>
                  <Button
                    size="sm"
                    onClick={() => setBulkMemberEmails(bulkMemberEmails.length === editableMembers.length ? [] : editableMembers.map(member => member.email))}
                    disabled={!editableMembers.length || bulkSaving}
                  >
                    {bulkMemberEmails.length === editableMembers.length ? '清空' : '全选'}
                  </Button>
                </div>
                <div className={bulkMemberGridClass}>
                  {editableMembers.map(member => (
                    <label className={bulkChoiceClass} key={member.email}>
                      <input
                        className={permissionCheckboxClass}
                        type="checkbox"
                        checked={bulkMemberEmails.includes(member.email)}
                        disabled={bulkSaving}
                        onChange={() => toggleBulkMember(member.email)}
                      />
                      <span className="min-w-0 flex-1 truncate">{member.email}</span>
                      <span className="flex-none text-[11px] text-[var(--muted)]">{member.modules.length}</span>
                    </label>
                  ))}
                  {!editableMembers.length ? <p className={emptyClass}>还没有员工账号。</p> : null}
                </div>
              </div>

              <div className={adminFormClass}>
                <div className={bulkActionsClass}>
                  <span className="text-[12px] font-semibold text-[var(--muted)]">选择权限</span>
                  <div className={bulkModeClass}>
                    {([
                      ['append', '追加'],
                      ['remove', '移除'],
                      ['replace', '覆盖']
                    ] as const).map(([mode, label]) => (
                      <button
                        type="button"
                        className={cn(bulkModeButtonClass, bulkMode === mode ? bulkModeButtonActiveClass : '')}
                        key={mode}
                        disabled={bulkSaving}
                        onClick={() => setBulkMode(mode)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={bulkModuleGridClass}>
                  {ALL_PERMISSION_MODULES.map(moduleKey => (
                    <label className={bulkChoiceClass} key={moduleKey}>
                      <input
                        className={permissionCheckboxClass}
                        type="checkbox"
                        checked={bulkModules.includes(moduleKey)}
                        disabled={bulkSaving}
                        onChange={() => toggleBulkModule(moduleKey)}
                      />
                      <span>{moduleLabels[moduleKey]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className={bulkActionsClass}>
              <p className="m-0 text-[12px] leading-[1.6] text-[var(--muted)]">追加是在现有权限上增加；移除只取消选中的模块；覆盖会把员工权限替换成这里勾选的模块。</p>
              <Button variant="primary" disabled={bulkSaving || !bulkMemberEmails.length || !bulkModules.length} onClick={() => void applyBulkPermissions()}>
                {bulkSaving ? '保存中...' : '应用到所选员工'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={adminGridClass}>
        <Card>
          <CardHeader>
            <CardTitle className={adminCardTitleClass}>员工账号</CardTitle>
            <Button size="sm" onClick={() => void refreshMembers()} disabled={busy}>刷新</Button>
          </CardHeader>
          <CardContent>
            <div className={adminSideListClass}>
              {editableMembers.map(member => {
                const activeMember = selectedMember?.email === member.email;
                return (
                  <button
                    type="button"
                    className={cn(adminSideItemClass, activeMember ? adminSideItemActiveClass : '')}
                    key={member.email}
                    onClick={() => setSelectedEmail(member.email)}
                  >
                    <span className="min-w-0 truncate">{member.email}</span>
                    <span className="flex-none text-[11px]">{member.modules.length}</span>
                  </button>
                );
              })}
              {!editableMembers.length ? <p className={emptyClass}>{busy ? '正在读取账号...' : '还没有员工账号，请先到账号管理创建。'}</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className={adminCardTitleClass}>模块权限</CardTitle>
            {selectedMember ? (
              <div className={permissionHeaderActionsClass}>
                <span className={permissionsDirty ? permissionDirtyBadgeClass : permissionSavedBadgeClass}>{permissionsDirty ? '未保存' : '已保存'}</span>
                <span className={adminMemberRoleClass}>{draftModules.length} / {ALL_PERMISSION_MODULES.length}</span>
                {permissionsDirty ? <Button size="sm" disabled={savingPermissions} onClick={resetDraftModules}>撤销</Button> : null}
                <Button size="sm" variant="primary" disabled={savingPermissions || !permissionsDirty} onClick={() => void savePermissions()}>
                  {savingPermissions ? '保存中...' : '保存权限'}
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            {selectedMember ? (
              <div className={adminFormClass}>
                <p className="m-0 truncate text-[13px] font-semibold text-[var(--text)]">{selectedMember.email}</p>
                <div className={permissionGridClass}>
                  {ALL_PERMISSION_MODULES.map(moduleKey => {
                    const checked = draftModules.includes(moduleKey);
                    return (
                      <label className={permissionItemClass} key={moduleKey}>
                        <span className="inline-flex items-center gap-2">
                          {checked ? <Check size={14} strokeWidth={2.4} className="text-[var(--accent)]" aria-hidden="true" /> : <span className="h-3.5 w-3.5" aria-hidden="true" />}
                          {moduleLabels[moduleKey]}
                        </span>
                        <input
                          className={permissionCheckboxClass}
                          type="checkbox"
                          checked={checked}
                          disabled={savingPermissions}
                          onChange={() => toggleModule(moduleKey)}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className={emptyClass}>选择员工后配置模块权限。</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminPageFrame>
  );
}

function ProjectSettingsPage({ active = true }: AdminPageProps) {
  const { authState, error } = useAdminMembers(active);
  const [copiedLink, setCopiedLink] = useState('');
  const [copyingRules, setCopyingRules] = useState(false);
  const config = TKFirestoreConnection.getConfig();
  const rulesSource = TKFirestoreConnection.getRulesSource();
  const parsedConfig = config?.configText ? JSON.parse(config.configText) as Record<string, unknown> : null;
  const projectId = authState.projectId || config?.projectId || '';
  const authDomain = String(parsedConfig?.authDomain || (projectId ? `${projectId}.firebaseapp.com` : ''));
  const appId = String(parsedConfig?.appId || '');
  const apiKey = String(parsedConfig?.apiKey || '');
  const maskedApiKey = apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : '-';

  async function copyConnectionLink() {
    try {
      const link = TKFirestoreConnection.createConnectionLink();
      await TKFirestoreConnection.copyText(link);
      setCopiedLink(link);
      TKFirestoreConnection.showToast('成员连接链接已复制');
    } catch (copyError) {
      TKFirestoreConnection.showToast(copyError instanceof Error ? copyError.message : '连接链接复制失败', 'error');
    }
  }

  async function copyRules() {
    setCopyingRules(true);
    try {
      await TKFirestoreConnection.copyRules();
      TKFirestoreConnection.showToast('规则已复制');
    } catch (copyError) {
      TKFirestoreConnection.showToast(copyError instanceof Error ? copyError.message : '规则复制失败', 'error');
    } finally {
      setCopyingRules(false);
    }
  }

  return (
    <AdminPageFrame
      active={active}
      icon={<Settings2 size={22} strokeWidth={2.2} aria-hidden="true" />}
      title="项目配置"
      copy="查看当前 Firebase 连接、成员连接链接和正在使用的 Firestore 规则。这里的信息只对管理员账号显示。"
    >
      {error ? (
        <Alert variant="danger" className="text-[12.5px]">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className={adminCardTitleClass}>项目状态</CardTitle>
          <span className={permissionSavedBadgeClass}>已初始化</span>
        </CardHeader>
        <CardContent>
          <div className={settingsGridClass}>
            <div className={settingsInfoClass}>
              <div className={settingsLabelClass}>项目 ID</div>
              <div className={settingsValueClass}>{projectId || '-'}</div>
            </div>
            <div className={settingsInfoClass}>
              <div className={settingsLabelClass}>Auth 域名</div>
              <div className={settingsValueClass}>{authDomain || '-'}</div>
            </div>
            <div className={settingsInfoClass}>
              <div className={settingsLabelClass}>当前管理员</div>
              <div className={settingsValueClass}>{authState.user?.email || authState.user?.uid || '-'}</div>
            </div>
            <div className={settingsInfoClass}>
              <div className={settingsLabelClass}>App ID</div>
              <div className={settingsValueClass}>{appId || '-'}</div>
            </div>
            <div className={settingsInfoClass}>
              <div className={settingsLabelClass}>API Key</div>
              <div className={settingsValueClass}>{maskedApiKey}</div>
            </div>
            <div className={settingsInfoClass}>
              <div className={settingsLabelClass}>权限模式</div>
              <div className={settingsValueClass}>Firebase Auth + Firestore Rules</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={adminCardTitleClass}>Firebase 连接配置</CardTitle>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" onClick={() => void copyConnectionLink()}><Copy aria-hidden="true" />复制成员连接链接</Button>
            <Button size="sm" onClick={() => TKFirestoreConnection.openConsole()}><ExternalLink aria-hidden="true" />打开 Firebase</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className={adminFormClass}>
            <p className={settingsSectionCopyClass}>这里是本项目的 firebaseConfig，用来让工具箱连接到你的 Firebase 项目。成员第一次通过连接链接导入后，后面直接打开同一个网址登录即可。</p>
            <Textarea className={settingsTextareaClass} readOnly value={config?.configText || ''} />
            {copiedLink ? <p className="m-0 truncate text-[11.5px] text-[var(--muted)]">{copiedLink}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={adminCardTitleClass}>Firestore 最新规则</CardTitle>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" disabled={copyingRules} onClick={() => void copyRules()}><Copy aria-hidden="true" />{copyingRules ? '复制中...' : '复制最新规则'}</Button>
            <Button size="sm" onClick={() => TKFirestoreConnection.openConsole('rules')}><ExternalLink aria-hidden="true" />打开 Rules</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className={adminFormClass}>
            <p className={settingsSectionCopyClass}>这里展示的是当前工具箱内置的最新 Firestore Rules。初始化和后续更新规则时复制的都是这同一份内容。</p>
            <pre className={settingsCodeBoxClass}>{rulesSource}</pre>
          </div>
        </CardContent>
      </Card>
    </AdminPageFrame>
  );
}

export { AccountManagementPage, PermissionManagementPage, ProjectSettingsPage };
