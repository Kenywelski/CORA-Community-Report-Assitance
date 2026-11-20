import {
  BriefcaseMedical,
  Building2,
  Coins,
  FileText,
  HandHelping,
  Landmark,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

interface OfficeAppearance {
  icon: LucideIcon;
  iconClass: string;
}

export const getOfficeAppearance = (officeName: string): OfficeAppearance => {
  const name = officeName.toLowerCase();
  const iconClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';

  if (name.includes('punong')) {
    return { icon: Landmark, iconClass };
  }
  if (name.includes('sangguniang kabataan')) {
    return { icon: HandHelping, iconClass };
  }
  if (name.includes('sangguniang barangay')) {
    return { icon: Users, iconClass };
  }
  if (name.includes('treasurer') || name.includes('finance')) {
    return { icon: Coins, iconClass };
  }
  if (name.includes('secretariat') || name.includes('records')) {
    return { icon: FileText, iconClass };
  }
  if (name.includes('secretary')) {
    return { icon: FileText, iconClass };
  }
  if (name.includes('health')) {
    return { icon: BriefcaseMedical, iconClass };
  }
  if (name.includes('peacekeeping') || name.includes('bdrrmc')) {
    return { icon: ShieldCheck, iconClass };
  }

  return { icon: Building2, iconClass };
};
