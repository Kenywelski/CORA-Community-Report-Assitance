import { supabase } from '@/integrations/supabase/client';

export interface BarangayOfficeItem {
  id: string;
  name: string;
  head_or_role: string;
  phone: string;
  email: string;
  location: string;
  hours: string;
  services_offered: string;
  is_active: boolean;
  updated_at: string;
}

export interface BarangayProgramItem {
  id: string;
  title: string;
  category:
    | 'Health & Wellness'
    | 'Youth & Education'
    | 'Livelihood & Agriculture'
    | 'Environment & Sanitation'
    | 'Senior Citizens & Social Welfare'
    | 'Peace & Disaster Preparedness';
  description: string;
  schedule: string;
  location: string;
  target_participants: string;
  coordinator: string;
  status: 'Active' | 'Upcoming' | 'Completed';
  is_active: boolean;
  updated_at: string;
}

const OFFICES_STORAGE_KEY = 'cora:barangay_offices_v1';
const PROGRAMS_STORAGE_KEY = 'cora:barangay_programs_v1';

export const DEFAULT_BARANGAY_OFFICES: BarangayOfficeItem[] = [
  {
    id: 'office-punong-barangay',
    name: 'Office of the Punong Barangay',
    head_or_role: 'Punong Barangay & Sangguniang Barangay',
    phone: '(086) 211-3041 / 0917-550-0101',
    email: 'punongbarangay.purisima@tago.gov.ph',
    location: 'Barangay Hall Main Building, Purok Citrus I, Barangay Purisima, Tago',
    hours: 'Monday – Friday, 8:00 AM – 5:00 PM',
    services_offered:
      'Barangay governance, official endorsements, dispute mediation (Lupong Tagapamayapa), and community concerns.',
    is_active: true,
    updated_at: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'office-barangay-secretary',
    name: 'Barangay Secretariat & Records Office',
    head_or_role: 'Barangay Secretary',
    phone: '0917-550-0102',
    email: 'secretariat.purisima@tago.gov.ph',
    location: 'Ground Floor, Barangay Hall, Barangay Purisima, Tago',
    hours: 'Monday – Friday, 8:00 AM – 5:00 PM',
    services_offered:
      'Barangay Clearance, Certificate of Residency, Certificate of Indigency, civil registry assistance, and resident records.',
    is_active: true,
    updated_at: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'office-health-station',
    name: 'Barangay Purisima Health Station',
    head_or_role: 'Barangay Midwife & Barangay Health Workers (BHW)',
    phone: '0917-550-0103',
    email: 'health.purisima@tago.gov.ph',
    location: 'Beside Barangay Hall Plaza, Barangay Purisima, Tago',
    hours: 'Monday – Friday, 8:00 AM – 5:00 PM (24/7 First-Aid On-Call)',
    services_offered:
      'Maternal & child health checkups, immunization, blood pressure monitoring, nutrition monitoring, and basic medicine distribution.',
    is_active: true,
    updated_at: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'office-tanod-bdrrmc',
    name: 'Barangay Peacekeeping (BPAT) & BDRRMC Operations Center',
    head_or_role: 'Chief Tanod & BDRRMC Focal Person',
    phone: '0917-550-0104',
    email: 'bdrrmc.purisima@tago.gov.ph',
    location: 'Barangay Outpost, National Highway Junction, Barangay Purisima, Tago',
    hours: 'Open 24/7',
    services_offered:
      'Peace and order patrol, flood and typhoon monitoring, emergency response coordination, and road/streetlight hazard inspection.',
    is_active: true,
    updated_at: '2026-10-01T08:00:00.000Z',
  },
];

export const DEFAULT_BARANGAY_PROGRAMS: BarangayProgramItem[] = [
  {
    id: 'program-clean-green',
    title: 'Linis Purok & Solid Waste Segregation Drive',
    category: 'Environment & Sanitation',
    description:
      'Weekly community clean-up drive, canal declogging, and household waste segregation campaign across all 9 Puroks of Barangay Purisima.',
    schedule: 'Every Saturday, 6:00 AM – 9:00 AM',
    location: 'All Puroks (Assembly at Barangay Purisima Covered Court)',
    target_participants: 'All households, youth volunteers, and Purok leaders',
    coordinator: 'Committee on Environment & Sanitation',
    status: 'Active',
    is_active: true,
    updated_at: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'program-maternal-nutrition',
    title: 'Buntis, Sanggol at Nutrisyon Barangay Outreach',
    category: 'Health & Wellness',
    description:
      'Free prenatal checkups, child immunization, vitamin supplementation, and feeding program for children and expectant mothers.',
    schedule: 'Every Wednesday, 8:30 AM – 12:00 NN',
    location: 'Barangay Purisima Health Station',
    target_participants: 'Expectant mothers, infants, and children ages 0–5',
    coordinator: 'Barangay Health Workers (BHW) & Midwife',
    status: 'Active',
    is_active: true,
    updated_at: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'program-livelihood-agri',
    title: 'Gulayan sa Barangay & Sustainable Farming Support',
    category: 'Livelihood & Agriculture',
    description:
      'Distribution of vegetable seedlings, organic composting workshops, and livelihood support for farmers and home gardeners in Barangay Purisima.',
    schedule: '1st and 3rd Thursday of the Month, 9:00 AM – 3:00 PM',
    location: 'Barangay Demo Farm, Purok Mangga I',
    target_participants: 'Local farmers, women’s associations, and interested residents',
    coordinator: 'Committee on Agriculture & Livelihood',
    status: 'Active',
    is_active: true,
    updated_at: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'program-youth-skills',
    title: 'SK Digital Literacy & Youth Sports Development',
    category: 'Youth & Education',
    description:
      'Free computer literacy sessions, scholarship orientation, and inter-purok sports clinics organized by the Sangguniang Kabataan.',
    schedule: 'Every Sunday, 1:00 PM – 5:00 PM',
    location: 'Barangay Purisima Multi-Purpose Hall & Covered Court',
    target_participants: 'Kabataan ages 15–30 across all Puroks',
    coordinator: 'Sangguniang Kabataan (SK) Council',
    status: 'Active',
    is_active: true,
    updated_at: '2026-10-01T08:00:00.000Z',
  },
];

function readLocalOffices(): BarangayOfficeItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OFFICES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalOffices(items: BarangayOfficeItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFICES_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cora:offices-updated'));
  } catch {
    // ignore storage errors
  }
}

function readLocalPrograms(): BarangayProgramItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PROGRAMS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalPrograms(items: BarangayProgramItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROGRAMS_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cora:programs-updated'));
  } catch {
    // ignore storage errors
  }
}

export async function loadBarangayOffices(): Promise<BarangayOfficeItem[]> {
  try {
    const { data, error } = await supabase
      .from('municipal_knowledge')
      .select('*')
      .eq('category', 'Barangay Office')
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      const parsed: BarangayOfficeItem[] = data.map((row) => {
        let meta: Partial<BarangayOfficeItem> = {};
        try {
          meta = JSON.parse(row.content);
        } catch {
          meta = { services_offered: row.content };
        }
        return {
          id: row.id,
          name: row.title,
          head_or_role: meta.head_or_role || 'Barangay Office',
          phone: meta.phone || 'N/A',
          email: meta.email || 'purisima@tago.gov.ph',
          location: meta.location || 'Barangay Purisima, Tago, Surigao del Sur',
          hours: meta.hours || 'Monday – Friday, 8:00 AM – 5:00 PM',
          services_offered: meta.services_offered || row.content || '',
          is_active: row.is_active,
          updated_at: row.updated_at,
        };
      });
      writeLocalOffices(parsed);
      return parsed;
    }
  } catch {
    // fallback to local storage
  }

  const local = readLocalOffices();
  if (local) return local;

  writeLocalOffices(DEFAULT_BARANGAY_OFFICES);
  return DEFAULT_BARANGAY_OFFICES;
}

export async function saveBarangayOffice(
  item: Omit<BarangayOfficeItem, 'id' | 'updated_at'> & { id?: string }
): Promise<BarangayOfficeItem[]> {
  const current = await loadBarangayOffices();
  const now = new Date().toISOString();
  const id = item.id || crypto.randomUUID();

  const nextItem: BarangayOfficeItem = {
    id,
    name: item.name.trim(),
    head_or_role: item.head_or_role.trim(),
    phone: item.phone.trim(),
    email: item.email.trim(),
    location: item.location.trim(),
    hours: item.hours.trim(),
    services_offered: item.services_offered.trim(),
    is_active: item.is_active,
    updated_at: now,
  };

  try {
    const contentJson = JSON.stringify({
      head_or_role: nextItem.head_or_role,
      phone: nextItem.phone,
      email: nextItem.email,
      location: nextItem.location,
      hours: nextItem.hours,
      services_offered: nextItem.services_offered,
    });

    if (item.id && !item.id.startsWith('office-')) {
      await supabase
        .from('municipal_knowledge')
        .update({
          title: nextItem.name,
          category: 'Barangay Office',
          content: contentJson,
          is_active: nextItem.is_active,
          tags: ['office', 'directory', 'purisima'],
        })
        .eq('id', item.id);
    } else if (!item.id) {
      const { data } = await supabase
        .from('municipal_knowledge')
        .insert({
          title: nextItem.name,
          category: 'Barangay Office',
          content: contentJson,
          is_active: nextItem.is_active,
          tags: ['office', 'directory', 'purisima'],
        })
        .select('id')
        .maybeSingle();
      if (data?.id) {
        nextItem.id = data.id;
      }
    }
  } catch {
    // fallback to local storage update
  }

  const exists = current.some((o) => o.id === item.id);
  const updated = exists
    ? current.map((o) => (o.id === item.id ? nextItem : o))
    : [nextItem, ...current];

  writeLocalOffices(updated);
  return updated;
}

export async function deleteBarangayOffice(
  id: string
): Promise<BarangayOfficeItem[]> {
  const current = await loadBarangayOffices();
  try {
    if (!id.startsWith('office-')) {
      await supabase.from('municipal_knowledge').delete().eq('id', id);
    }
  } catch {
    // ignore
  }
  const updated = current.filter((o) => o.id !== id);
  writeLocalOffices(updated);
  return updated;
}

export async function loadBarangayPrograms(): Promise<BarangayProgramItem[]> {
  try {
    const { data, error } = await supabase
      .from('municipal_knowledge')
      .select('*')
      .eq('category', 'Barangay Program')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const parsed: BarangayProgramItem[] = data.map((row) => {
        let meta: Partial<BarangayProgramItem> = {};
        try {
          meta = JSON.parse(row.content);
        } catch {
          meta = { description: row.content };
        }
        return {
          id: row.id,
          title: row.title,
          category: meta.category || 'Health & Wellness',
          description: meta.description || row.content || '',
          schedule: meta.schedule || 'TBA',
          location: meta.location || 'Barangay Purisima, Tago',
          target_participants: meta.target_participants || 'All Residents',
          coordinator: meta.coordinator || 'Barangay Purisima Council',
          status: meta.status || 'Active',
          is_active: row.is_active,
          updated_at: row.updated_at,
        };
      });
      writeLocalPrograms(parsed);
      return parsed;
    }
  } catch {
    // fallback to local storage
  }

  const local = readLocalPrograms();
  if (local) return local;

  writeLocalPrograms(DEFAULT_BARANGAY_PROGRAMS);
  return DEFAULT_BARANGAY_PROGRAMS;
}

export async function saveBarangayProgram(
  item: Omit<BarangayProgramItem, 'id' | 'updated_at'> & { id?: string }
): Promise<BarangayProgramItem[]> {
  const current = await loadBarangayPrograms();
  const now = new Date().toISOString();
  const id = item.id || crypto.randomUUID();

  const nextItem: BarangayProgramItem = {
    id,
    title: item.title.trim(),
    category: item.category,
    description: item.description.trim(),
    schedule: item.schedule.trim(),
    location: item.location.trim(),
    target_participants: item.target_participants.trim(),
    coordinator: item.coordinator.trim(),
    status: item.status,
    is_active: item.is_active,
    updated_at: now,
  };

  try {
    const contentJson = JSON.stringify({
      category: nextItem.category,
      description: nextItem.description,
      schedule: nextItem.schedule,
      location: nextItem.location,
      target_participants: nextItem.target_participants,
      coordinator: nextItem.coordinator,
      status: nextItem.status,
    });

    if (item.id && !item.id.startsWith('program-')) {
      await supabase
        .from('municipal_knowledge')
        .update({
          title: nextItem.title,
          category: 'Barangay Program',
          content: contentJson,
          is_active: nextItem.is_active,
          tags: ['program', nextItem.category.toLowerCase(), 'purisima'],
        })
        .eq('id', item.id);
    } else if (!item.id) {
      const { data } = await supabase
        .from('municipal_knowledge')
        .insert({
          title: nextItem.title,
          category: 'Barangay Program',
          content: contentJson,
          is_active: nextItem.is_active,
          tags: ['program', nextItem.category.toLowerCase(), 'purisima'],
        })
        .select('id')
        .maybeSingle();
      if (data?.id) {
        nextItem.id = data.id;
      }
    }
  } catch {
    // fallback to local storage update
  }

  const exists = current.some((p) => p.id === item.id);
  const updated = exists
    ? current.map((p) => (p.id === item.id ? nextItem : p))
    : [nextItem, ...current];

  writeLocalPrograms(updated);
  return updated;
}

export async function deleteBarangayProgram(
  id: string
): Promise<BarangayProgramItem[]> {
  const current = await loadBarangayPrograms();
  try {
    if (!id.startsWith('program-')) {
      await supabase.from('municipal_knowledge').delete().eq('id', id);
    }
  } catch {
    // ignore
  }
  const updated = current.filter((p) => p.id !== id);
  writeLocalPrograms(updated);
  return updated;
}
