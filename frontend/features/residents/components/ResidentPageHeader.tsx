import { cn } from '@/lib/utils';
import { useAppPreferences } from '@/lib/preferences';

interface ResidentPageHeaderProps {
  title: string;
  subtitle: string;
  className?: string;
}

export const ResidentPageHeader = ({
  title,
  subtitle,
  className,
}: ResidentPageHeaderProps) => {
  const { translate } = useAppPreferences();

  return (
    <header className={cn('flex items-stretch gap-3', className)}>
      <span
        aria-hidden="true"
        className="min-h-[52px] w-1.5 shrink-0 rounded-full bg-primary"
      />
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold leading-tight tracking-[-0.035em] text-foreground sm:text-[30px]">
          {translate(title)}
        </h1>
        <p className="mt-[5px] text-sm font-medium leading-[1.35] text-muted-foreground">
          {translate(subtitle)}
        </p>
      </div>
    </header>
  );
};
