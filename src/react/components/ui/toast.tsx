import { cn } from '@/lib/utils';

type ToastTone = 'ok' | 'error';

type ToastProps = {
  message: string;
  type?: ToastTone;
  visible?: boolean;
};

function Toast({ message, type = 'ok', visible = false }: ToastProps) {
  return (
    <div
      id="toast"
      data-slot="toast"
      className={cn(
        'fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-[10px] border bg-[var(--panel)] px-[18px] py-2.5 text-[13px] shadow-[var(--shadow)]',
        visible ? 'show block' : 'hidden',
        type === 'error' ? 'border-[var(--danger)] text-[var(--danger)]' : 'border-[var(--ok)] text-[var(--ok)]'
      )}
    >
      {message}
    </div>
  );
}

export { Toast };
export type { ToastProps, ToastTone };
