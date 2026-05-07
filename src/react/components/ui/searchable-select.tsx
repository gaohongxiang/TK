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
    <div ref={rootRef} data-slot="searchable-select" className={cn('tk-search-select', open ? 'is-open' : '', disabled ? 'is-disabled' : '', !value ? 'is-empty' : '')} data-item-role={role}>
      {hiddenField ? <input type="hidden" data-item-field={hiddenField} value={value} readOnly /> : null}
      <button
        ref={triggerRef}
        type="button"
        className="tk-search-select-trigger"
        data-role="trigger"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen(current => !current);
        }}
      >
        <span className="tk-search-select-trigger-label" data-role="label">{selected?.label || (value ? `${value}（已不存在）` : placeholder)}</span>
        <span className="tk-search-select-trigger-icon" aria-hidden="true">▾</span>
      </button>
      <div className="tk-search-select-panel" data-role="panel" style={panelStyle}>
        <div className="tk-search-select-search">
          <input ref={searchRef} type="text" data-role="search" placeholder={searchPlaceholder} value={query} onChange={event => setQuery(event.target.value)} />
        </div>
        <div className="tk-search-select-options" data-role="options">
          <button
            type="button"
            className={cn('tk-search-select-option', !value ? 'is-active' : '')}
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
              className={cn('tk-search-select-option', option.value === value ? 'is-active' : '')}
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
          {!filtered.length ? <div className="tk-search-select-empty">没有匹配项</div> : null}
        </div>
      </div>
    </div>
  );
}

export { SearchableSelect };
export type { SearchableSelectOption, SearchableSelectProps };
