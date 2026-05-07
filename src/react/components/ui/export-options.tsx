import type { ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type ExportOption = {
  key: string;
  label: string;
  count: number;
};

type ExportOptionsProps = {
  allCheckboxId: string;
  checkboxClassName?: string;
  countLabel: (count: number) => ReactNode;
  options: ExportOption[];
  optionsId: string;
  selected: Set<string>;
  onSelectedChange: (value: Set<string>) => void;
};

function ExportOptions({
  allCheckboxId,
  checkboxClassName,
  countLabel,
  onSelectedChange,
  options,
  optionsId,
  selected
}: ExportOptionsProps) {
  const allChecked = options.length > 0 && options.every(option => selected.has(option.key));

  function toggleOption(optionKey: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(optionKey);
    else next.delete(optionKey);
    onSelectedChange(next);
  }

  return (
    <div className="flex flex-col gap-2.5" data-slot="export-options">
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,.035)] px-3 py-2.5">
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <Checkbox
            id={allCheckboxId}
            checked={allChecked}
            onChange={event => onSelectedChange(event.target.checked ? new Set(options.map(option => option.key)) : new Set())}
          />
          <span>全部账号</span>
        </span>
      </label>
      <div id={optionsId} className="flex max-h-[280px] flex-col gap-2 overflow-auto">
        {options.map(option => (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,.02)] px-3 py-2.5" key={option.key}>
            <span className="inline-flex min-w-0 items-center gap-2.5">
              <Checkbox
                className={cn(checkboxClassName)}
                value={option.key}
                checked={selected.has(option.key)}
                onChange={event => toggleOption(option.key, event.target.checked)}
              />
              <span className="text-[13px] text-[var(--text)]">{option.label}</span>
            </span>
            <span className="whitespace-nowrap text-xs text-[var(--muted)]">{countLabel(option.count)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export { ExportOptions };
export type { ExportOption, ExportOptionsProps };
