type SyncStatusTone = 'idle' | 'saving' | 'saved' | 'error' | string;

type SyncStatusKind = 'unconnected' | 'refreshing' | 'queueing' | 'confirmed' | 'stale' | 'failed';

type SyncStatusOptions = {
  moduleLabel?: string;
  count?: number;
  unit?: string;
  action?: string;
  error?: string;
  autoRefreshSeconds?: number | null;
};

type SyncStatus = {
  kind: SyncStatusKind;
  text: string;
  className: SyncStatusTone;
};

function formatSyncCount(count: unknown, unit = '条'): string {
  const parsed = Number(count);
  if (!Number.isFinite(parsed)) return '';
  return `${parsed} ${unit}`;
}

function buildFirestoreSyncStatus(kind: SyncStatusKind, options: SyncStatusOptions = {}): SyncStatus {
  const countText = formatSyncCount(options.count, options.unit || '条');
  if (kind === 'unconnected') {
    return { kind, text: '未连接', className: '' };
  }
  if (kind === 'refreshing') {
    return { kind, text: '正在刷新云端数据…', className: 'saving' };
  }
  if (kind === 'queueing') {
    return { kind, text: `${options.action || '更改'}已进入本机待上传队列…`, className: 'saving' };
  }
  if (kind === 'confirmed') {
    return {
      kind,
      text: countText ? `云端已同步 · ${countText}` : '云端已同步',
      className: 'saved'
    };
  }
  if (kind === 'stale') {
    const seconds = Number(options.autoRefreshSeconds);
    return {
      kind,
      text: Number.isFinite(seconds) && seconds > 0
        ? `有新数据，${Math.ceil(seconds)}s 后自动刷新`
        : '有新数据，点击刷新',
      className: 'stale'
    };
  }
  return {
    kind,
    text: options.error || 'Firestore 同步失败，已保留本地视图',
    className: 'error'
  };
}

export {
  buildFirestoreSyncStatus,
  formatSyncCount
};

export type {
  SyncStatus,
  SyncStatusKind,
  SyncStatusOptions,
  SyncStatusTone
};
