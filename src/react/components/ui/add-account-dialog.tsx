import { Button } from '@/components/ui/button';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormRow } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

type AddAccountDialogProps = {
  open: boolean;
  value: string;
  modalId: string;
  formId: string;
  inputId: string;
  title?: string;
  placeholder?: string;
  onValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

function AddAccountDialog({
  open,
  value,
  modalId,
  formId,
  inputId,
  title = '添加新账号',
  placeholder = '例如：NOMA',
  onValueChange,
  onOpenChange,
  onConfirm
}: AddAccountDialogProps) {
  return (
    <Dialog id={modalId} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogTitle>{title}</DialogTitle>
        <form id={formId} autoComplete="off" onSubmit={event => { event.preventDefault(); onConfirm(); }}>
          <FormRow>
            <FormField label="账号名称" full>
              <Input id={inputId} value={value} placeholder={placeholder} required onChange={event => onValueChange(event.target.value)} />
            </FormField>
          </FormRow>
          <DialogActions>
            <Button onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" variant="primary">确定</Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { AddAccountDialog };
export type { AddAccountDialogProps };
