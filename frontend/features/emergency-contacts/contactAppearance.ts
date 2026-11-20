import {
  Anchor,
  BriefcaseMedical,
  Flame,
  HeartHandshake,
  HeartPulse,
  Landmark,
  ShieldCheck,
  Siren,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export interface EmergencyContactAppearance {
  icon: LucideIcon;
  iconClass: string;
}

const serviceAppearances: Record<string, EmergencyContactAppearance> = {
  police: {
    icon: ShieldCheck,
    iconClass: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  },
  fire: {
    icon: Flame,
    iconClass: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
  },
  'disaster/rescue': {
    icon: BriefcaseMedical,
    iconClass: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  },
  'health/hospital': {
    icon: HeartPulse,
    iconClass: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  },
  maritime: {
    icon: Anchor,
    iconClass: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400',
  },
  government: {
    icon: Landmark,
    iconClass: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  },
  barangay: {
    icon: UsersRound,
    iconClass: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
  },
};

const departmentAppearances: Record<string, EmergencyContactAppearance> = {
  'PHILIPPINE RED CROSS': {
    icon: HeartHandshake,
    iconClass: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  },
  'COAST GUARD STATION': serviceAppearances.maritime,
  'TAGO POLICE STATION': serviceAppearances.police,
  'TAGO BUREAU OF FIRE PROTECTION': serviceAppearances.fire,
  'BUREAU OF FIRE PROTECTION': serviceAppearances.fire,
  MDRRMC: serviceAppearances['disaster/rescue'],
  'MUNICIPAL HEALTH OFFICE': serviceAppearances['health/hospital'],
  'BARANGAY EMERGENCY HOTLINE': serviceAppearances.barangay,
  'TAGO MUNICIPAL HALL': serviceAppearances.government,
  'LGU TAGO': serviceAppearances.government,
};

const defaultAppearance: EmergencyContactAppearance = {
  icon: Siren,
  iconClass: 'bg-primary/10 text-primary',
};

export const getEmergencyContactAppearance = (
  departmentName: string,
  serviceType: string,
): EmergencyContactAppearance =>
  departmentAppearances[departmentName.trim().toUpperCase()] ??
  serviceAppearances[serviceType.trim().toLowerCase()] ??
  defaultAppearance;
