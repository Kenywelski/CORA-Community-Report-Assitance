import { CalendarDays, Construction, Siren, type LucideIcon } from 'lucide-react';
import type { BarangayProgramGroup } from '@/lib/barangayContentStore';

interface ProgramAppearance {
  icon: LucideIcon;
  iconClass: string;
}

export const getProgramAppearance = (
  programGroup: BarangayProgramGroup | null,
): ProgramAppearance => {
  switch (programGroup) {
    case 'Disaster Management Programs':
      return {
        icon: Siren,
        iconClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
      };
    case 'Infrastructure Programs':
      return {
        icon: Construction,
        iconClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
      };
    default:
      return { icon: CalendarDays, iconClass: 'bg-primary/10 text-primary' };
  }
};
