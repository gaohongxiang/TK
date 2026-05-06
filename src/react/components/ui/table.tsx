import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('ot', className)} {...props} />;
}

function TableHeader(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} />;
}

function TableHead(props: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th {...props} />;
}

function TableCell(props: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} />;
}

export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
};
