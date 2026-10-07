import * as React from 'react';
import { cn } from '@/components/ui/cn';

// DESIGN.md §4 Table: lives in a card (`<Card className="overflow-hidden"><Table/></Card>`), subtle header band,
// 56px rows with a quiet hover, numbers right-aligned + tabular (on the <table>). The table scrolls horizontally
// inside its wrapper (never the page). Text size `text-table` (14px) sits on the wrapper so a colour class passed
// to <Table className> cannot drop it.

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  wrapperClassName?: string;
  /**
   * The header row stays visible while the table scrolls INSIDE its wrapper — give the wrapper a height limit,
   * e.g. wrapperClassName="max-h-[60vh]".
   */
  stickyHeader?: boolean;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, wrapperClassName, stickyHeader = false, ...props }, ref) => (
    <div
      className={cn('relative w-full overflow-x-auto text-table', stickyHeader && 'scrollbar-thin overflow-y-auto', wrapperClassName)}
    >
      <table
        ref={ref}
        data-sticky-header={stickyHeader || undefined}
        className={cn(
          'tabular w-full caption-bottom border-collapse',
          stickyHeader && '[&>thead]:sticky [&>thead]:top-0 [&>thead]:z-10',
          className,
        )}
        {...props}
      />
    </div>
  ),
);
Table.displayName = 'Table';

// The header line is an inset shadow on the cells (a collapsed row border would not travel with a sticky header).
// Colour: `text-caption` here, size `text-micro` on the cells (one class cannot carry both).
const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn('bg-subtle text-caption [&_tr:hover]:bg-transparent [&_tr]:border-b-0', className)}
      {...props}
    />
  ),
);
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  ),
);
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn('border-t border-border bg-subtle font-medium [&>tr]:last:border-b-0 [&_tr:hover]:bg-transparent', className)}
      {...props}
    />
  ),
);
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-border/60 transition-colors duration-150 hover:bg-subtle data-[state=selected]:bg-primary-soft/60',
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-10 whitespace-nowrap px-3 text-left align-middle text-micro font-medium shadow-[inset_0_-1px_0_0_rgb(var(--border))] first:pl-4 last:pr-4',
        '[&:has([role=checkbox])]:w-10 [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn('h-14 px-3 py-2.5 align-middle text-foreground first:pl-4 last:pr-4 [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  ),
);
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => <caption ref={ref} className={cn('mt-4 text-caption', className)} {...props} />,
);
TableCaption.displayName = 'TableCaption';

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
