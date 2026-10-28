export type FaqCategory = 'all' | 'getting-started' | 'reporting' | 'tracking' | 'barangay';

export interface FaqAction {
  label: string;
  type: 'scroll' | 'navigate';
  target: string;
}

export interface FaqItem {
  id: string;
  category: Exclude<FaqCategory, 'all'>;
  question: string;
  shortLabel: string;
  keywords: string[];
  answer: string;
  relatedIds: string[];
  action?: FaqAction;
}

export interface LiveLandingContext {
  emergencyContacts?: Array<{
    department_name: string;
    service_type: string;
    contact_number: string;
    availability?: string;
  }>;
  announcements?: Array<{
    title: string;
    type: string;
    published_at: string;
  }>;
  programs?: Array<{
    title: string;
    category: string;
  }>;
}

export interface FaqReplyResult {
  matchedFaqId: string | null;
  answer: string;
  relatedQuestions: FaqItem[];
  action?: FaqAction;
}

export const FAQ_CATEGORIES: Array<{ id: FaqCategory; label: string }> = [
  { id: 'all', label: 'All FAQs' },
  { id: 'getting-started', label: 'About CORA' },
  { id: 'reporting', label: 'Reporting' },
  { id: 'tracking', label: 'Account & Status' },
  { id: 'barangay', label: 'Barangay Info' },
];

export const CORA_FAQS: FaqItem[] = [
  {
    id: 'what-is-cora',
    category: 'getting-started',
    shortLabel: 'What is CORA?',
    question: 'What is CORA and how does it help Barangay Purisima?',
    keywords: [
      'what', 'cora', 'about', 'system', 'platform', 'purpose', 'ano', 'unsa',
      'purisima', 'tago', 'overview', 'explain', 'portal', 'community reporting',
    ],
    answer:
      '**CORA (Community Reporting Assistance)** is the official community reporting and public information system for **Barangay Purisima, Tago, Surigao del Sur**.\n\nIt connects residents and barangay officials in one platform so you can:\n- **Report community concerns** with photos and location pins\n- **Monitor report progress** from submission to resolution\n- **Access official barangay information** including announcements, programs, and emergency contacts',
    relatedIds: ['how-to-report', 'supported-concerns', 'need-account'],
    action: {
      label: 'See How CORA Works',
      type: 'scroll',
      target: 'how-it-works',
    },
  },
  {
    id: 'how-to-report',
    category: 'reporting',
    shortLabel: 'How to submit a report?',
    question: 'How do I submit a community concern in CORA?',
    keywords: [
      'how', 'report', 'submit', 'file', 'concern', 'issue', 'complaint', 'paano',
      'unsaon', 'step', 'steps', 'process', 'send', 'mag-report', 'magreport',
    ],
    answer:
      'Submitting a concern in CORA takes **4 simple steps**:\n\n1. **Sign in or create an account** using your email address.\n2. **Capture and submit the concern** — select a category, describe the issue (by typing or using the Voice Assistant), attach a photo, and pin the location in Barangay Purisima.\n3. **Monitor the status** from your **My Reports** dashboard.\n4. **Receive official updates** as barangay personnel review, process, and resolve your report.',
    relatedIds: ['supported-concerns', 'voice-reporting', 'track-status'],
    action: {
      label: 'Report a Concern Now',
      type: 'navigate',
      target: '/auth',
    },
  },
  {
    id: 'supported-concerns',
    category: 'reporting',
    shortLabel: 'What issues can I report?',
    question: 'What types of community concerns can I report?',
    keywords: [
      'type', 'types', 'category', 'categories', 'kind', 'what issues', 'concerns',
      'garbage', 'waste', 'basura', 'streetlight', 'light', 'ilaw', ' suga',
      'drainage', 'flood', 'baha', 'kanal', 'road', 'pothole', 'kalsada', 'lubak',
      'damage', 'pwede', 'ireport',
    ],
    answer:
      'You can submit community concerns across Barangay Purisima under these main categories:\n\n- **Improper Waste Disposal** — Uncollected garbage, illegal dumping, or roadside litter.\n- **Streetlight Problem** — Non-functioning, flickering, or damaged street lighting.\n- **Drainage / Flooding Concern** — Clogged canals, blocked waterways, or localized flooding.\n- **Road Damage** — Potholes, cracked pavement, or damaged pathways.\n- **Other Barangay Concerns** — Public safety, water supply, or general community maintenance issues.',
    relatedIds: ['how-to-report', 'photo-location', 'track-status'],
    action: {
      label: 'View Concern Categories',
      type: 'scroll',
      target: 'community-concerns',
    },
  },
  {
    id: 'need-account',
    category: 'tracking',
    shortLabel: 'Do I need an account?',
    question: 'Do I need an account to use CORA?',
    keywords: [
      'account', 'register', 'registration', 'sign in', 'login', 'log in', 'signup',
      'sign up', 'guest', 'anonymous', 'kailangan', 'need', 'free', 'bayad',
    ],
    answer:
      '- **Public Information (No Account Needed):** Anyone can view official Barangay Purisima announcements, barangay programs, the interactive barangay map, and emergency contact numbers right here on the landing page.\n- **Submitting & Tracking Reports (Free Account Required):** Creating a free resident account is required to submit a concern so you can track its status and receive official updates from barangay personnel.',
    relatedIds: ['is-it-free', 'how-to-report', 'privacy-safety'],
    action: {
      label: 'Sign In / Create Account',
      type: 'navigate',
      target: '/auth',
    },
  },
  {
    id: 'track-status',
    category: 'tracking',
    shortLabel: 'How to track my report?',
    question: 'How do I check the status of my submitted report?',
    keywords: [
      'track', 'status', 'monitor', 'check', 'update', 'updates', 'progress',
      'pending', 'resolved', 'in progress', 'my reports', 'follow up', 'kumusta',
    ],
    answer:
      'Once signed in, open **My Reports** from your resident dashboard to see real-time status updates:\n\n- **Pending** — Your report has been received and is awaiting review by barangay staff.\n- **In Progress** — Authorized personnel are actively addressing or coordinating action on the issue.\n- **Resolved** — The concern has been addressed, with official remarks posted on your report timeline.\n\nYou will also receive notifications inside the portal whenever your report status changes.',
    relatedIds: ['how-to-report', 'who-reviews', 'need-account'],
    action: {
      label: 'Sign In to Track Reports',
      type: 'navigate',
      target: '/auth',
    },
  },
  {
    id: 'voice-reporting',
    category: 'reporting',
    shortLabel: 'Can I speak in Tagalog or Bisaya?',
    question: 'Can I use voice reporting or speak in Tagalog / Bisaya?',
    keywords: [
      'voice', 'speak', 'audio', 'microphone', 'tagalog', 'filipino', 'bisaya',
      'cebuano', 'surigaonon', 'language', 'ai', 'organize', 'salita', 'boses',
    ],
    answer:
      '**Yes!** When submitting a report in your resident dashboard, you can use the **Speak Your Report** voice assistant:\n\n- Speak naturally in **English, Filipino/Tagalog, or Bisaya/Cebuano**.\n- CORA transcribes your statement and helps organize it into a clear report title and description that you can review and edit before submitting.\n- **Privacy Note:** Your raw voice recording is never stored — only the final text report you approve is submitted.',
    relatedIds: ['how-to-report', 'photo-location', 'privacy-safety'],
  },
  {
    id: 'photo-location',
    category: 'reporting',
    shortLabel: 'Are photos & location required?',
    question: 'Do I need to attach a photo and pin the location?',
    keywords: [
      'photo', 'picture', 'image', 'camera', 'location', 'pin', 'gps', 'map',
      'purok', 'address', 'litrato', 'larawan', 'saan', 'asa',
    ],
    answer:
      'Adding a **photo** and **location pin** helps barangay personnel locate and verify the issue much faster:\n\n- **Photos:** You can take a photo directly with your phone camera or upload an existing image showing the issue.\n- **Location:** You can use your device GPS, pick a point on the Barangay Purisima map, or specify the landmark / purok in your description.',
    relatedIds: ['how-to-report', 'supported-concerns', 'where-is-purisima'],
  },
  {
    id: 'who-reviews',
    category: 'tracking',
    shortLabel: 'Who handles my report?',
    question: 'Who reviews and responds to submitted reports?',
    keywords: [
      'who', 'officials', 'staff', 'admin', 'barangay hall', 'captain', 'kagawad',
      'personnel', 'handle', 'review', 'response', 'sino', 'kinsa', 'time', 'how long',
    ],
    answer:
      'Submitted reports are reviewed by **authorized Barangay Purisima personnel and administrators**.\n\n- Officials validate the report details, prioritize urgent safety or infrastructure concerns, and coordinate with the appropriate barangay committee or Municipal of Tago office.\n- Official remarks and status updates are posted directly to your report so you stay informed.',
    relatedIds: ['track-status', 'privacy-safety', 'emergency-contacts'],
  },
  {
    id: 'emergency-contacts',
    category: 'barangay',
    shortLabel: 'Emergency hotlines',
    question: 'What should I do in an urgent emergency, and where are the hotlines?',
    keywords: [
      'emergency', 'hotline', 'phone', 'contact', 'number', 'police', 'pnp',
      'fire', 'bfp', 'ambulance', 'rescue', 'mdrrmo', 'hospital', 'urgent', 'tulong', 'tabang',
    ],
    answer:
      'For **life-threatening or urgent emergencies** (fire, crime, medical emergency, active disaster), please call emergency response hotlines immediately rather than waiting for an online report.\n\nYou can view verified emergency numbers for **Barangay Purisima and Tago, Surigao del Sur** in the **Emergency Contacts** section on this page.',
    relatedIds: ['where-is-purisima', 'what-is-cora', 'announcements-programs'],
    action: {
      label: 'View Emergency Contacts',
      type: 'scroll',
      target: 'emergency-contacts',
    },
  },
  {
    id: 'where-is-purisima',
    category: 'barangay',
    shortLabel: 'Where is Barangay Purisima?',
    question: 'Where is Barangay Purisima located?',
    keywords: [
      'where', 'location', 'barangay purisima', 'tago', 'surigao del sur',
      'coordinates', 'caraga', 'zip code', '8302', 'map', 'boundary',
    ],
    answer:
      '**Barangay Purisima** is an official barangay in the **Municipality of Tago, Province of Surigao del Sur, Caraga Region (Region XIII), Philippines** (Postal Code `8302`, coordinates `9.0281° N, 126.1973° E`).\n\nYou can explore the interactive map of Barangay Purisima right here on the landing page.',
    relatedIds: ['what-is-cora', 'emergency-contacts', 'announcements-programs'],
    action: {
      label: 'Explore Barangay Map',
      type: 'scroll',
      target: 'explore-purisima',
    },
  },
  {
    id: 'announcements-programs',
    category: 'barangay',
    shortLabel: 'Announcements & Programs',
    question: 'Where can I see official barangay announcements and programs?',
    keywords: [
      'announcement', 'announcements', 'advisory', 'news', 'events', 'program',
      'programs', 'services', 'schedule', 'balita', 'anunsyo', 'updates',
    ],
    answer:
      'Official **Announcements** (general notices, community events, and urgent advisories) and **Barangay Programs** are published directly on the CORA landing page and in the public portal — no sign-in required.',
    relatedIds: ['what-is-cora', 'need-account', 'emergency-contacts'],
    action: {
      label: 'View Announcements',
      type: 'scroll',
      target: 'announcements',
    },
  },
  {
    id: 'is-it-free',
    category: 'getting-started',
    shortLabel: 'Is CORA free to use?',
    question: 'Is CORA free for residents of Barangay Purisima?',
    keywords: [
      'free', 'cost', 'fee', 'charge', 'pay', 'payment', 'bayad', 'libre',
    ],
    answer:
      '**Yes, CORA is 100% free** for all residents of Barangay Purisima. Creating an account, submitting community concerns, and viewing official barangay updates have no fees.',
    relatedIds: ['need-account', 'how-to-report', 'what-is-cora'],
  },
  {
    id: 'privacy-safety',
    category: 'tracking',
    shortLabel: 'Is my report private?',
    question: 'Is my personal information kept private when I submit a report?',
    keywords: [
      'private', 'privacy', 'safe', 'security', 'confidential', 'personal',
      'data', 'identity', 'name', 'secret', 'ligtas',
    ],
    answer:
      '**Yes.** Your account details and contact information are protected and accessible only to authorized barangay administrators handling your report so they can verify the concern and send you official status updates.',
    relatedIds: ['who-reviews', 'need-account', 'voice-reporting'],
  },
];

export function getFaqsByCategory(category: FaqCategory): FaqItem[] {
  if (category === 'all') return CORA_FAQS;
  return CORA_FAQS.filter((item) => item.category === category);
}

export function getFaqById(id: string): FaqItem | undefined {
  return CORA_FAQS.find((item) => item.id === id);
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function answerSystemFaq(
  userQuery: string,
  liveContext?: LiveLandingContext
): FaqReplyResult {
  const trimmed = userQuery.trim();
  const normalized = normalizeText(trimmed);

  // 1. Check exact match on question or shortLabel first
  const exact = CORA_FAQS.find(
    (f) =>
      normalizeText(f.question) === normalized ||
      normalizeText(f.shortLabel) === normalized
  );
  if (exact) {
    return buildResultFromFaq(exact, liveContext);
  }

  // 2. Check greetings
  if (
    /^(hi|hello|hey|kumusta|kamusta|maayong buntag|maayong hapon|maayong gabii|good morning|good afternoon|good evening|help)$/.test(
      normalized
    )
  ) {
    const welcomeFaq = CORA_FAQS[0];
    return {
      matchedFaqId: 'greeting',
      answer:
        'Kumusta! Welcome to the **CORA FAQ Assistant** for **Barangay Purisima, Tago, Surigao del Sur**.\n\nI can answer your questions about how to report community concerns, what issues you can submit, how report tracking works, or where to find barangay emergency contacts. Choose a question below or type your question!',
      relatedQuestions: [
        CORA_FAQS[0],
        CORA_FAQS[1],
        CORA_FAQS[2],
        CORA_FAQS[3],
      ],
      action: welcomeFaq.action,
    };
  }

  // 3. Score each FAQ item by keyword and token matches
  const tokens = normalized.split(' ').filter((t) => t.length >= 2);
  let bestFaq: FaqItem | null = null;
  let bestScore = 0;

  for (const faq of CORA_FAQS) {
    let score = 0;
    const questionNorm = normalizeText(faq.question);
    const shortNorm = normalizeText(faq.shortLabel);

    for (const kw of faq.keywords) {
      const kwNorm = normalizeText(kw);
      if (!kwNorm) continue;
      if (normalized.includes(kwNorm)) {
        score += kwNorm.includes(' ') ? 5 : 3;
      }
    }

    for (const token of tokens) {
      if (questionNorm.includes(token)) score += 2;
      if (shortNorm.includes(token)) score += 2;
      if (faq.keywords.some((k) => normalizeText(k) === token)) score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestFaq = faq;
    }
  }

  if (bestFaq && bestScore >= 3) {
    return buildResultFromFaq(bestFaq, liveContext);
  }

  // 4. Helpful fallback with top FAQs
  return {
    matchedFaqId: null,
    answer:
      "Here's what I can help you with regarding **CORA (Community Reporting Assistance)** for **Barangay Purisima**:\n\n- **How to Report:** Sign in, choose a category, attach a photo & location pin, and submit.\n- **Supported Concerns:** Improper Waste Disposal, Streetlight Problems, Drainage/Flooding, and Road Damage.\n- **Public Access:** Announcements, Barangay Programs, the Barangay Map, and Emergency Contacts are open to everyone.\n\nSelect any topic below for detailed guidance:",
    relatedQuestions: [
      CORA_FAQS[0],
      CORA_FAQS[1],
      CORA_FAQS[2],
      CORA_FAQS[8],
    ],
    action: {
      label: 'See How CORA Works',
      type: 'scroll',
      target: 'how-it-works',
    },
  };
}

function buildResultFromFaq(
  faq: FaqItem,
  liveContext?: LiveLandingContext
): FaqReplyResult {
  let enrichedAnswer = faq.answer;

  if (
    faq.id === 'emergency-contacts' &&
    liveContext?.emergencyContacts &&
    liveContext.emergencyContacts.length > 0
  ) {
    const list = liveContext.emergencyContacts
      .slice(0, 4)
      .map(
        (c) =>
          `- **${c.department_name}** (${c.service_type}): \`${c.contact_number}\``
      )
      .join('\n');
    enrichedAnswer += `\n\n**Verified Hotlines:**\n${list}`;
  }

  if (
    faq.id === 'announcements-programs' &&
    liveContext?.announcements &&
    liveContext.announcements.length > 0
  ) {
    const latest = liveContext.announcements
      .slice(0, 2)
      .map((a) => `- **${a.title}**`)
      .join('\n');
    enrichedAnswer += `\n\n**Latest Published Announcements:**\n${latest}`;
  }

  const relatedQuestions = faq.relatedIds
    .map((id) => getFaqById(id))
    .filter((item): item is FaqItem => Boolean(item));

  return {
    matchedFaqId: faq.id,
    answer: enrichedAnswer,
    relatedQuestions,
    action: faq.action,
  };
}
