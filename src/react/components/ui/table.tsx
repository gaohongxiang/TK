import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table data-slot="table" className={cn('w-full border-collapse text-[13px]', className)} {...props} />;
}

function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead data-slot="table-header" className={cn(className)} {...props} />;
}

function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr data-slot="table-row" className={cn(className)} {...props} />;
}

function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th data-slot="table-head" className={cn('border-b border-dashed border-[var(--border)] bg-transparent px-2 py-2.5 text-center align-middle text-[11.5px] font-semibold uppercase tracking-[.3px] text-[var(--muted)]', className)} {...props} />;
}

function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td data-slot="table-cell" className={cn('border-b border-dashed border-[var(--border)] px-2 py-2.5 text-center align-middle font-normal', className)} {...props} />;
}

export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
};
