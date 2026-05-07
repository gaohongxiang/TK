import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type SearchableSelectOption = {
  value: string;
  label: string;
  searchLabel?: string;
};

type SearchableSelectProps = {
  disabled?: boolean;
  hiddenField?: string;
  options: SearchableSelectOption[];
  placeholder: string;
  role?: string;
  searchPlaceholder: string;
  value: string;
  onChange: (value: string) => void;
};

function SearchableSelect({
  disabled = false,
  hiddenField,
  options,
  placeholder,
  role,
  searchPlaceholder,
  value,
  onChange
}: SearchableSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panelStyle, setPanelStyle] = useState<Record<string, string>>({});
  const selected = options.find(option => option.value === value) || null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(option => String(option.searchLabel || option.label || option.value).toLowerCase().includes(needle));
  }, [options, query]);

  function positionPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportGap = 12;
    const width = Math.max(rect.width, 260);
    const left = Math.min(Math.max(viewportGap, rect.left), Math.max(viewportGap, window.innerWidth - width - viewportGap));
    const spaceBelow = window.innerHeight - rect.bottom - viewportGap;
    const maxHeight = Math.max(180, Math.min(320, spaceBelow || 280));
    setPanelStyle({
      top: `${rect.bottom + 6}px`,
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: `${maxHeight}px`
    });
  }

  useEffect(() => {
    if (!open) return undefined;
    positionPanel();
    searchRef.current?.focus();
    const closeOnPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const reposition = () => positionPanel();
    document.addEventListener('mousedown', closeOnPointer);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', closeOnPointer);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      data-slot="searchable-select"
      className={cn(
        'tk-search-select relative w-full',
        open ? 'is-open z-[120]' : '',
        disabled ? 'is-disabled' : '',
        !value ? 'is-empty' : ''
      )}
      data-item-role={role}
    >
      {hiddenField ? <input type="hidden" data-item-field={hiddenField} value={value} readOnly /> : null}
      <button
        ref={triggerRef}
        type="button"
        className="tk-search-select-trigger flex h-10 min-h-10 w-full items-center justify-between gap-3 rounded-[10px] border border-[color-mix(in_srgb,var(--border)_82%,white)] bg-[color-mix(in_srgb,var(--panel2)_38%,white)] px-3 text-left text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
        data-role="trigger"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen(current => !current);
        }}
      >
        <span className={cn('tk-search-select-trigger-label min-w-0 flex-1 truncate text-center text-[13.5px]', !value ? 'text-[var(--muted)]' : '')} data-role="label">{selected?.label || (value ? `${value}（已不存在）` : placeholder)}</span>
        <span className="tk-search-select-trigger-icon shrink-0 text-xs text-[var(--muted)]" aria-hidden="true">▾</span>
      </button>
      <div
        className={cn(
          'tk-search-select-panel fixed left-0 top-0 z-[420] w-[280px] rounded-[14px] border border-[color-mix(in_srgb,var(--border)_88%,white)] bg-[color-mix(in_srgb,var(--panel)_96%,white)] shadow-[0_18px_36px_rgba(19,29,52,.08)]',
          open ? 'block' : 'hidden'
        )}
        data-role="panel"
        style={panelStyle}
      >
        <div className="tk-search-select-search border-b border-[color-mix(in_srgb,var(--border)_88%,white)] p-2.5">
          <input
            ref={searchRef}
            type="text"
            data-role="search"
            className="h-[38px] min-h-[38px] w-full rounded-[10px] border border-[var(--border)] bg-[var(--panel2)] px-3 text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(110,168,255,.2)]"
            placeholder={searchPlaceholder}
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        <div className="tk-search-select-options max-h-60 overflow-auto p-2" data-role="options">
          <button
            type="button"
            className={cn(
              'tk-search-select-option w-full rounded-[10px] border-0 bg-transparent px-3 py-2.5 text-left text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel2))]',
              !value ? 'is-active bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel2))]' : ''
            )}
            data-option-value=""
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(false);
            }}
          >
            <span className="tk-search-select-option-label">{placeholder}</span>
          </button>
          {filtered.map(option => (
            <button
              type="button"
              className={cn(
                'tk-search-select-option w-full rounded-[10px] border-0 bg-transparent px-3 py-2.5 text-left text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel2))]',
                option.value === value ? 'is-active bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel2))]' : ''
              )}
              data-option-value={option.value}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setQuery('');
                setOpen(false);
              }}
            >
              <span className="tk-search-select-option-label">{option.label}</span>
            </button>
          ))}
          {!filtered.length ? <div className="tk-search-select-empty p-3 text-[12.5px] text-[var(--muted)]">没有匹配项</div> : null}
        </div>
      </div>
    </div>
  );
}

export { SearchableSelect };
export type { SearchableSelectOption, SearchableSelectProps };
