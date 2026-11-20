import { ArrowLeft, ArrowRight, Check, type LucideIcon } from 'lucide-react';
import { ResidentPageHeader } from '@/features/residents/components/ResidentPageHeader';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useAppPreferences } from '@/lib/preferences';

const WORKFLOW_STEPS = ['Capture', 'Details', 'Location', 'Review'];

interface ReportWorkflowStepsProps {
  currentStep: 1 | 2 | 3 | 4;
}

export const ReportWorkflowSteps = ({
  currentStep,
}: ReportWorkflowStepsProps) => {
  const { translate } = useAppPreferences();

  return (
    <div
      className="grid grid-cols-4"
      aria-label={translate('Report step {step} of {total}', { step: currentStep, total: 4 })}
    >
      {WORKFLOW_STEPS.map((label, index) => {
        const number = (index + 1) as 1 | 2 | 3 | 4;
        const complete = number < currentStep;
        const active = number === currentStep;

        return (
          <div key={label} className="relative flex min-w-0 flex-col items-center">
            {index > 0 && (
              <span
                className={cn(
                  'absolute right-1/2 top-[15px] h-px w-full',
                  number <= currentStep ? 'bg-[#39A77A]' : 'bg-[#D7E1E8]'
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold shadow-sm',
                complete && 'border-[#39A77A] bg-[#39A77A] text-white',
                active && 'border-[#168276] bg-[#168276] text-white',
                !complete && !active &&
                  'border-[#CBD8E2] bg-white text-[#425B6B] dark:border-border dark:bg-card'
              )}
            >
              {complete ? <Check className="h-4 w-4" strokeWidth={3} /> : number}
            </span>
            <span
              className={cn(
                'relative z-10 mt-1.5 px-1 text-center text-[10px] font-medium leading-tight sm:text-[11px]',
                active
                  ? 'font-bold text-[#087565] dark:text-emerald-300'
                  : 'text-[#334E60] dark:text-muted-foreground'
              )}
            >
              {translate(label === 'Review' ? 'Review & Submit' : label)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const ReportDesktopHeader = () => (
  <ResidentPageHeader
    title="Report a Concern"
    subtitle="Report community issues in Barangay Purisima."
    className="w-full py-1"
  />
);

interface ReportWorkflowHeadingProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  testId?: string;
}

export const ReportWorkflowHeading = ({
  icon: Icon,
  title,
  description,
  className,
  testId,
}: ReportWorkflowHeadingProps) => {
  const { translate } = useAppPreferences();

  return (
    <div data-testid={testId} className={cn('flex items-start gap-3', className)}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E4F8F0] text-[#0A9964] dark:bg-emerald-400/15 dark:text-emerald-300 sm:h-14 sm:w-14">
        <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2} />
      </span>
      <div className="min-w-0 pt-0.5">
        <h1 className="text-xl font-extrabold leading-tight tracking-[-0.035em] text-[#07121F] dark:text-foreground sm:text-2xl">
          {translate(title)}
        </h1>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#40576B] dark:text-muted-foreground sm:text-sm">
          {translate(description)}
        </p>
      </div>
    </div>
  );
};

interface DesktopWorkflowActionsProps {
  onBack: () => void;
  onCancel: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueType?: 'button' | 'submit';
  showBack?: boolean;
  testId?: string;
  className?: string;
}

interface CancelReportButtonProps {
  onCancel: () => void;
  className?: string;
}

export const CancelReportButton = ({
  onCancel,
  className,
}: CancelReportButtonProps) => {
  const { translate } = useAppPreferences();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="default"
          className={cn(
            'h-10 min-w-[108px] rounded-xl border-0 bg-[#DC2626] px-5 font-bold text-white shadow-none hover:bg-[#B91C1C] hover:text-white dark:bg-[#DC2626] dark:text-white dark:hover:bg-[#B91C1C] dark:hover:text-white',
            className
          )}
        >
          {translate('Cancel')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100vw-3rem)] max-w-[18rem] rounded-2xl border-0 p-4 sm:w-full sm:max-w-md sm:p-6">
        <AlertDialogHeader>
          <AlertDialogTitle>{translate('Cancel this report?')}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{translate('Keep Editing')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onCancel}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {translate('Discard Report')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const DesktopWorkflowActions = ({
  onBack,
  onCancel,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
  continueType = 'button',
  showBack = true,
  testId,
  className,
}: DesktopWorkflowActionsProps) => {
  const { translate } = useAppPreferences();

  return (
    <div
      className={cn(
        'hidden items-center border-t border-border pt-3 lg:flex',
        showBack ? 'justify-between' : 'justify-end',
        className
      )}
    >
      {showBack && (
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-10 min-w-[108px] rounded-xl border-[#CDDCE4] px-5 font-bold text-[#17303E] dark:border-border dark:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {translate('Back')}
        </Button>
      )}

      <div className="flex items-center gap-3">
        <CancelReportButton onCancel={onCancel} />
        <Button
          type={continueType}
          data-testid={testId}
          disabled={continueDisabled}
          onClick={onContinue}
          className="h-10 min-w-[148px] rounded-xl bg-primary px-6 font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          {translate(continueLabel)}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
