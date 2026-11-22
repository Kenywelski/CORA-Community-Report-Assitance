import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppPreferences } from '@/lib/preferences';
import { cn } from '@/lib/utils';

interface ResidentMobileBackHeaderProps {
  title: string;
  onBack: () => void;
  className?: string;
}

export const ResidentMobileBackHeader = ({
  title,
  onBack,
  className,
}: ResidentMobileBackHeaderProps) => {
  const { translate } = useAppPreferences();

  return (
    <header className={cn('relative mb-5 flex h-10 items-center justify-center lg:hidden', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label={translate('Back')}
        className="absolute left-0 h-9 w-9 rounded-full"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <h1 className="text-base font-bold tracking-tight text-[#17212b]">{translate(title)}</h1>
    </header>
  );
};
