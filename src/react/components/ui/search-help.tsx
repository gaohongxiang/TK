import { HelpCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { HelpItem, HelpStack } from '@/components/ui/help-stack';
import { cn } from '@/lib/utils';

type SearchHelpItem = {
  label: string;
  children: ReactNode;
};

type SearchHelpButtonProps = {
  id: string;
  modalId: string;
  title: string;
  open: boolean;
  items: SearchHelpItem[];
  onOpenChange: (open: boolean) => void;
};

function SearchHelpButton({ id, items, modalId, onOpenChange, open, title }: SearchHelpButtonProps) {
  const titleId = `${modalId}-title`;
  const dialog = (
    <Dialog id={modalId} open={open} titleId={titleId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <HelpStack>
          <HelpItem label="账号范围">搜索只作用于当前账号标签。“全部”里搜索全部账号的数据，具体账号标签里只搜索该账号的数据。</HelpItem>
          {items.map(item => <HelpItem label={item.label} key={item.label}>{item.children}</HelpItem>)}
        </HelpStack>
        <DialogActions>
          <Button variant="primary" onClick={() => onOpenChange(false)}>知道了</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <Button
        data-slot="search-help-button"
        id={id}
        size="smIcon"
        variant="plain"
        className={cn('h-8 w-8 shrink-0 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,.035)] text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] hover:text-[var(--accent)]')}
        aria-controls={modalId}
        aria-haspopup="dialog"
        aria-label={title}
        title={title}
        onClick={() => onOpenChange(true)}
      >
        <HelpCircle size={14} strokeWidth={2} aria-hidden="true" />
      </Button>
      {typeof document === 'undefined' ? dialog : createPortal(dialog, document.body)}
    </>
  );
}

export { SearchHelpButton };
export type { SearchHelpButtonProps, SearchHelpItem };
