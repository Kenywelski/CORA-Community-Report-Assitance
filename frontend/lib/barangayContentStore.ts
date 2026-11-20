import { supabase } from '@/integrations/supabase/client';

export interface BarangayOfficeItem {
  id: string;
  name: string;
  officials: BarangayOfficeOfficial[];
  responsibilities: string;
  phone: string;
  email: string;
  location: string;
  hours: string;
  is_active: boolean;
  updated_at: string;
}

export interface BarangayOfficeOfficial {
  name: string;
  position: string;
}

export const BARANGAY_OFFICE_NAMES = [
  'Office of the Punong Barangay',
  'Office of the Sangguniang Barangay',
  'Office of the Barangay Secretary',
  'Office of the Barangay Treasurer',
  'Office of the Sangguniang Kabataan',
] as const;

const KNOWN_OFFICIAL_POSITION_BY_NAME: Record<string, string> = {
  'emmanuel p isiang': 'Punong Barangay',
  'jose m ihapon jr': 'Barangay Kagawad',
  'charlita g montenegro': 'Barangay Kagawad',
  'jerusalem t montero': 'Barangay Kagawad',
  'jane c buniel': 'Barangay Kagawad',
  'eva m gemao': 'Barangay Kagawad',
  'john earl j elizalde': 'Barangay Kagawad',
  'vicente a portillo jr': 'Barangay Kagawad',
  'vince dylan e curada': 'Sangguniang Kabataan',
  'shannon james q porras': 'Barangay Secretary',
  'heries b dela cruz': 'Barangay Treasurer',
};

const KNOWN_OFFICIALS_BY_OFFICE: Record<string, BarangayOfficeOfficial[]> = {
  'office of the punong barangay': [
    { name: 'Emmanuel P. Isiang', position: 'Punong Barangay' },
  ],
  'office of the sangguniang barangay': [
    { name: 'Jose M. Ihapon, Jr.', position: 'Barangay Kagawad' },
    { name: 'Charlita G. Montenegro', position: 'Barangay Kagawad' },
    { name: 'Jerusalem T. Montero', position: 'Barangay Kagawad' },
    { name: 'Jane C. Buniel', position: 'Barangay Kagawad' },
    { name: 'Eva M. Gemao', position: 'Barangay Kagawad' },
    { name: 'John Earl J. Elizalde', position: 'Barangay Kagawad' },
    { name: 'Vicente A. Portillo, Jr.', position: 'Barangay Kagawad' },
  ],
  'office of the sangguniang kabataan': [
    { name: 'Vince Dylan E. Curada', position: 'Sangguniang Kabataan' },
  ],
  'office of the barangay secretary': [
    { name: 'Shannon James Q. Porras', position: 'Barangay Secretary' },
  ],
  'office of the barangay treasurer': [
    { name: 'Heries B. Dela Cruz', position: 'Barangay Treasurer' },
  ],
};

const normalizeOfficialName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[,.]/g, '')
    .replace(/\b(jr|sr)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeBarangayOfficeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/^office of (the )?/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const readOfficeOfficials = (
  value: unknown,
  officeName: string,
  legacyOfficialName: string,
): BarangayOfficeOfficial[] => {
  if (Array.isArray(value)) {
    return value.flatMap((official) => {
      if (!official || typeof official !== 'object' || Array.isArray(official)) {
        return [];
      }

      const { name, position } = official as Record<string, unknown>;
      if (typeof name !== 'string' || typeof position !== 'string') return [];
      return name.trim() ? [{ name: name.trim(), position: position.trim() }] : [];
    });
  }

  const knownOfficials =
    Object.entries(KNOWN_OFFICIALS_BY_OFFICE).find(
      ([knownOfficeName]) =>
        normalizeBarangayOfficeName(knownOfficeName) ===
        normalizeBarangayOfficeName(officeName),
    )?.[1] ?? [];
  if (knownOfficials.length > 0) return knownOfficials;

  const name = legacyOfficialName.trim();
  if (!name) return [];

  const position =
    KNOWN_OFFICIAL_POSITION_BY_NAME[normalizeOfficialName(name)] ?? '';
  return [{ name, position }];
};

export const BARANGAY_PROGRAM_GROUPS = [
  'Disaster Management Programs',
  'Infrastructure Programs',
] as const;

export type BarangayProgramGroup = (typeof BARANGAY_PROGRAM_GROUPS)[number];

export interface BarangayProgramItem {
  id: string;
  title: string;
  description: string;
  schedule: string;
  location: string;
  program_group: BarangayProgramGroup | null;
  status:
    | 'Upcoming'
    | 'Ongoing'
    | 'For Verification'
    | 'Completed'
    | 'Cancelled'
    | 'Not set';
  is_active: boolean;
  updated_at: string;
}

const normalizeProgramTitle = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const LEGACY_PROGRAM_GROUP_BY_TITLE: Record<string, BarangayProgramGroup> = {
  'desilting of canals': 'Disaster Management Programs',
  'trainings and seminars': 'Disaster Management Programs',
  'stockpiling of goods': 'Disaster Management Programs',
  'fuel and oil and lubricants for rescue vehicle': 'Disaster Management Programs',
  'uniform for barangay first responders': 'Disaster Management Programs',
  'monthly incentives for barangay first responders': 'Disaster Management Programs',
  'procurement of tires for rescue vehicle': 'Disaster Management Programs',
  'purchase of monoblock chairs for evacuation center': 'Disaster Management Programs',
  'purchase of plastic tables for evacuation center': 'Disaster Management Programs',
  'mobilization of response team': 'Disaster Management Programs',
  'concreting of barangay parking lot': 'Infrastructure Programs',
  'construction of barangay covered court bleachers': 'Infrastructure Programs',
  'construction of footbridge in purok citrus 1': 'Infrastructure Programs',
  'construction of drainage canal in purok mangga ii': 'Infrastructure Programs',
};

const isBarangayProgramGroup = (
  value: unknown,
): value is BarangayProgramGroup =>
  BARANGAY_PROGRAM_GROUPS.some((group) => group === value);

const readProgramGroup = (value: unknown, title: string): BarangayProgramGroup | null => {
  if (isBarangayProgramGroup(value)) return value;

  return LEGACY_PROGRAM_GROUP_BY_TITLE[normalizeProgramTitle(title)] ?? null;
};

const parseContent = (content: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {
      services_offered: content,
      responsibilities: content,
      description: content,
    };
  }
  return {};
};

const readText = (value: unknown, fallback: string) =>
  typeof value === 'string' ? value : fallback;

const readProgramStatus = (value: unknown): BarangayProgramItem['status'] => {
  if (typeof value !== 'string') return 'Not set';

  switch (value.trim().toLowerCase()) {
    case 'active':
    case 'ongoing':
      return 'Ongoing';
    case 'for verification':
      return 'For Verification';
    case 'upcoming':
      return 'Upcoming';
    case 'completed':
      return 'Completed';
    case 'cancelled':
    case 'canceled':
      return 'Cancelled';
    default:
      return 'Not set';
  }
};

const readProgramSchedule = (value: unknown) => {
  const schedule = readText(value, '').trim();
  return /^tba\b/i.test(schedule) || /confirm with/i.test(schedule)
    ? ''
    : schedule;
};

export async function loadBarangayOffices(): Promise<BarangayOfficeItem[]> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('category', 'Barangay Office')
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data.map((row) => {
    const meta = parseContent(row.content);
    return {
      id: row.id,
      name: row.title,
      officials: readOfficeOfficials(
        meta.officials,
        row.title,
        readText(meta.head_or_role, ''),
      ),
      responsibilities:
        readText(meta.responsibilities, '').trim() ||
        readText(meta.services_offered, ''),
      phone: readText(meta.phone, ''),
      email: readText(meta.email, ''),
      location: readText(meta.location, ''),
      hours: readText(meta.hours, ''),
      is_active: row.is_active,
      updated_at: row.updated_at,
    };
  });
}

export async function saveBarangayOffice(
  item: Omit<BarangayOfficeItem, 'id' | 'updated_at'> & { id?: string }
): Promise<BarangayOfficeItem[]> {
  const officeName = item.name.trim();
  if (!officeName) throw new Error('Office Name is required.');

  const incompleteOfficial = item.officials.some((official) => {
    const hasName = Boolean(official.name.trim());
    const hasPosition = Boolean(official.position.trim());
    return hasName !== hasPosition;
  });
  if (incompleteOfficial) {
    throw new Error('Each official must have both a name and a position.');
  }

  const { data: existingOffices, error: existingOfficesError } = await supabase
    .from('knowledge_base')
    .select('id, title')
    .eq('category', 'Barangay Office');

  if (existingOfficesError) throw existingOfficesError;

  const officeKey = normalizeBarangayOfficeName(officeName);
  const officeRows = existingOffices ?? [];
  const currentOffice = officeRows.find((office) => office.id === item.id);
  const duplicate = officeRows.some(
    (office) =>
      office.id !== item.id &&
      normalizeBarangayOfficeName(office.title) === officeKey,
  );
  if (
    duplicate &&
    (!currentOffice ||
      normalizeBarangayOfficeName(currentOffice.title) !== officeKey)
  ) {
    throw new Error('A barangay office with this name already exists.');
  }

  const payload = {
    title: officeName,
    category: 'Barangay Office',
    content: JSON.stringify({
      officials: item.officials
        .map(({ name, position }) => ({
          name: name.trim(),
          position: position.trim(),
        }))
        .filter((official) => official.name && official.position),
      responsibilities: item.responsibilities.trim(),
      phone: item.phone.trim(),
      email: item.email.trim(),
      location: item.location.trim(),
      hours: item.hours.trim(),
    }),
    is_active: item.is_active,
    tags: ['office', 'directory', 'purisima'],
    updated_at: new Date().toISOString(),
  };

  const { error } = item.id
    ? await supabase
        .from('knowledge_base')
        .update(payload)
        .eq('id', item.id)
        .select('id')
        .single()
    : await supabase
        .from('knowledge_base')
        .insert(payload)
        .select('id')
        .single();

  if (error) throw error;
  return loadBarangayOffices();
}

export async function deleteBarangayOffice(
  id: string
): Promise<BarangayOfficeItem[]> {
  const { error } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('id', id)
    .select('id')
    .single();

  if (error) throw error;
  return loadBarangayOffices();
}

export async function loadBarangayPrograms(): Promise<BarangayProgramItem[]> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('category', 'Barangay Program')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map((row) => {
    const meta = parseContent(row.content);

    return {
      id: row.id,
      title: row.title,
      description: readText(meta.description, row.content),
      schedule: readProgramSchedule(meta.schedule),
      location: readText(meta.location, ''),
      program_group: readProgramGroup(meta.program_group, row.title),
      status: readProgramStatus(meta.status),
      is_active: row.is_active,
      updated_at: row.updated_at,
    };
  });
}

export async function saveBarangayProgram(
  item: Omit<BarangayProgramItem, 'id' | 'updated_at'> & { id?: string }
): Promise<BarangayProgramItem[]> {
  const payload = {
    title: item.title.trim(),
    category: 'Barangay Program',
    content: JSON.stringify({
      description: item.description.trim(),
      schedule: item.schedule.trim(),
      location: item.location.trim(),
      program_group: item.program_group,
      status: item.status,
    }),
    is_active: item.is_active,
    tags: ['program', 'purisima'],
    updated_at: new Date().toISOString(),
  };

  const { error } = item.id
    ? await supabase
        .from('knowledge_base')
        .update(payload)
        .eq('id', item.id)
        .select('id')
        .single()
    : await supabase
        .from('knowledge_base')
        .insert(payload)
        .select('id')
        .single();

  if (error) throw error;
  return loadBarangayPrograms();
}

export async function deleteBarangayProgram(
  id: string
): Promise<BarangayProgramItem[]> {
  const { error } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('id', id)
    .select('id')
    .single();

  if (error) throw error;
  return loadBarangayPrograms();
}
