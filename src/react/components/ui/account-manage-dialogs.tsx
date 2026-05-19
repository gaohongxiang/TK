import { Button } from '@/components/ui/button';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormRow } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

type AccountEditDialogProps = {
  open: boolean;
  accountName: string;
  value: string;
  modalId: string;
  formId: string;
  inputId: string;
  onValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

type AccountDeleteDialogProps = {
  open: boolean;
  accountName: string;
  modalId: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

function AccountEditDialog({
  open,
  accountName,
  value,
  modalId,
  formId,
  inputId,
  onValueChange,
  onOpenChange,
  onConfirm
}: AccountEditDialogProps) {
  return (
    <Dialog id={modalId} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogTitle>编辑账号名</DialogTitle>
        <form id={formId} autoComplete="off" onSubmit={event => { event.preventDefault(); onConfirm(); }}>
          <p className="mb-4 text-[13px] leading-[1.7] text-[var(--muted)]">
            当前账号：{accountName}
          </p>
          <FormRow>
            <FormField label="新账号名称" full>
              <Input id={inputId} value={value} placeholder="例如：NOMA" required onChange={event => onValueChange(event.target.value)} />
            </FormField>
          </FormRow>
          <DialogActions>
            <Button onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" variant="primary">保存</Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountDeleteDialog({
  open,
  accountName,
  modalId,
  onOpenChange,
  onConfirm
}: AccountDeleteDialogProps) {
  return (
    <Dialog id={modalId} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogTitle>删除账号名</DialogTitle>
        <p className="m-0 text-[13px] leading-[1.8] text-[var(--muted)]">
          确定删除账号「{accountName}」？不会删除商品、订单或采集记录；这些数据之后只在“全部”里显示。
        </p>
        <DialogActions>
          <Button onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="danger" onClick={onConfirm}>删除账号名</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

export { AccountDeleteDialog, AccountEditDialog };
export type { AccountDeleteDialogProps, AccountEditDialogProps };
