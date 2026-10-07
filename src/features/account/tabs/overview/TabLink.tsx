// "Xem lộ trình →", "Tất cả liên hệ →": quiet link to another tab of the account (card header / footer).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { accountTabPath } from '../../accountTabs';
import type { AccountTab } from '../../accountTabs';

export const LINK_CLASS =
  'touch-tap group inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-md text-table font-medium text-primary transition-colors duration-150 hover:text-primary-hover';

export function TabLink({
  accountId,
  tab,
  children,
  className,
}: {
  accountId: string;
  tab: AccountTab;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link to={accountTabPath(accountId, tab)} className={cn(LINK_CLASS, className)}>
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-150 ease-out-quart group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}
