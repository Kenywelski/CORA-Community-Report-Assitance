import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AdminActionButtonProps = Omit<ButtonProps, 'variant' | 'size' | 'className' | 'aria-label'> & {
  action: 'edit' | 'delete';
  icon: LucideIcon;
  'aria-label': string;
  className?: string;
};

export const AdminActionButton = forwardRef<HTMLButtonElement, AdminActionButtonProps>(
  ({ action, icon: Icon, className, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="icon-sm"
      className={cn(
        `admin-action-${action} h-[34px] w-[34px] rounded-xl shadow-none`,
        action === 'edit'
          ? 'border-[#d5dee4] bg-[#f1f5f8] text-[#344054] hover:border-[#c5d0d7] hover:bg-[#e8eef2] hover:text-[#344054] dark:border-[#29444e] dark:bg-[#10232b] dark:text-[#dce7eb] dark:hover:border-[#29444e] dark:hover:bg-[#10232b] dark:hover:text-[#dce7eb]'
          : 'border-[#fecdd3] bg-[#fff1f2] text-[#be123c] hover:border-[#fda4af] hover:bg-[#ffe4e6] hover:text-[#be123c] dark:border-[#6a3540] dark:bg-[#2b1d24] dark:text-[#f08b9c] dark:hover:border-[#6a3540] dark:hover:bg-[#2b1d24] dark:hover:text-[#f08b9c]',
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" />
    </Button>
  ),
);

AdminActionButton.displayName = 'AdminActionButton';
