import { cn } from '@/lib/utils';

const statusStripClass = 'ot-bar flex flex-wrap items-center justify-between gap-3';
const statusStripLeftClass = 'left flex items-center gap-2.5 text-[12.5px] text-[var(--muted)]';
const statusStripRightClass = 'right flex flex-wrap items-center justify-end gap-2 [&_[data-slot=button]]:inline-flex [&_[data-slot=button]]:items-center [&_[data-slot=button]]:justify-center [&_[data-slot=button]]:gap-1.5 max-[768px]:w-full max-[768px]:justify-end';
const syncStatusBaseClass = 'sync min-h-[30px] text-xs text-[var(--muted)]';
const refreshIconButtonClass = 'calc-help-icon ot-refresh-inline h-[30px] w-[30px] bg-transparent [&_svg]:h-[15px] [&_svg]:w-[15px]';
const refreshIconBusyClass = 'is-spinning border-[color-mix(in_srgb,var(--accent)_42%,var(--border))] text-[var(--accent)] [&_svg]:animate-spin';
const storageHelpButtonClass = 'calc-help-icon ot-storage-help-btn h-[30px] w-[30px] [&_svg]:h-[15px] [&_svg]:w-[15px]';

function syncStatusClass(statusClass?: string) {
  return cn(
    syncStatusBaseClass,
    statusClass === 'saving' ? 'text-[var(--warn)]' : '',
    statusClass === 'saved' ? 'text-[var(--ok)]' : '',
    statusClass === 'local' ? 'text-[var(--accent)]' : '',
    statusClass === 'error' ? 'text-[var(--danger)]' : '',
    statusClass
  );
}

function refreshButtonClass(loading?: boolean, className?: string) {
  return cn(refreshIconButtonClass, loading ? refreshIconBusyClass : '', className);
}

export {
  refreshButtonClass,
  statusStripClass,
  statusStripLeftClass,
  statusStripRightClass,
  storageHelpButtonClass,
  syncStatusClass
};
