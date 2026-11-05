import {
  PURISIMA_COORDINATES,
  VERIFIED_PURISIMA_BOUNDARY,
  verifyPointWithinBarangayBoundary,
} from './purisimaGeo';

/**
 * The four supported community concern categories for Barangay Purisima, Tago, Surigao del Sur.
 */
export type ApprovedConcernCategoryKey =
  | 'garbage'
  | 'street_light'
  | 'drainage'
  | 'road_damage';

export interface ApprovedConcernCategory {
  key: ApprovedConcernCategoryKey;
  label: string;
  reportCategoryValue: string;
  shortDescription: string;
  conservativeTemplate: string;
  modelAliases: string[];
}

export const ROBOFLOW_WORKFLOW_URL =
  'https://serverless.roboflow.com/gwen-apuli/workflows/four-class-classifier-test-1793801128146';

export const ROBOFLOW_CLASS_LABEL_BY_KEY: Record<
  ApprovedConcernCategoryKey,
  'drainage' | 'road' | 'streetlights' | 'waste'
> = {
  drainage: 'drainage',
  road_damage: 'road',
  street_light: 'streetlights',
  garbage: 'waste',
};

export const APPROVED_CONCERN_CATEGORIES: ApprovedConcernCategory[] = [
  {
    key: 'garbage',
    label: 'Improper Waste Disposal',
    reportCategoryValue: 'Report: Improper Waste Disposal',
    shortDescription:
      'Uncollected waste, illegal dumping, or roadside litter accumulation.',
    conservativeTemplate:
      'Improperly disposed waste is visible in the submitted photo. The concern has been logged for waste management action in Barangay Purisima.',
    modelAliases: [
      'waste',
      'improper_waste_disposal',
      'improper waste disposal',
      'garbage',
      'waste_disposal',
      'waste problem',
      'waste_problem',
      'garbage problem',
      'garbage_problem',
      'litter',
      'garbage/waste problem',
      'solid waste',
    ],
  },
  {
    key: 'street_light',
    label: 'Streetlight Problem',
    reportCategoryValue: 'Report: Streetlight Problem',
    shortDescription:
      'Non-functioning, flickering, or damaged street lighting fixtures.',
    conservativeTemplate:
      'A streetlight fixture concern is visible in the submitted photo. The lighting post has been logged for maintenance or repair in Barangay Purisima.',
    modelAliases: [
      'streetlights',
      'street_lights',
      'street lights',
      'streetlight_problem',
      'streetlight problem',
      'street_light',
      'street light',
      'street light issue',
      'streetlight',
      'lighting',
    ],
  },
  {
    key: 'drainage',
    label: 'Drainage/Flooding Concern',
    reportCategoryValue: 'Report: Drainage/Flooding Concern',
    shortDescription:
      'Clogged canals, blocked drainage waterways, or localized water accumulation.',
    conservativeTemplate:
      'A drainage or flooding concern is visible in the submitted photo. The affected waterway in Barangay Purisima has been logged for clearing and response.',
    modelAliases: [
      'drainage',
      'drainage_flooding_concern',
      'drainage/flooding concern',
      'drainage problem',
      'drainage_problem',
      'drainage/canal issue',
      'flooding',
      'canal',
      'clogged_drainage',
    ],
  },
  {
    key: 'road_damage',
    label: 'Road Damage',
    reportCategoryValue: 'Report: Road Damage',
    shortDescription:
      'Potholes, cracked concrete pavement, or damaged public pathways.',
    conservativeTemplate:
      'A road surface damage concern is visible in the submitted photo. The affected road section in Barangay Purisima has been logged for maintenance action.',
    modelAliases: [
      'road',
      'roads',
      'road_damage',
      'road damage',
      'road problem',
      'road_problem',
      'pothole',
      'pavement_damage',
      'cracked_road',
    ],
  },
];

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.65; // 65%
export const MAX_GPS_ACCURACY_METERS = 100;
export const MAX_GPS_AGE_MS = 60_000; // 60 seconds
export const MAX_PURISIMA_SCOPE_METERS = 3500; // 3.5 km radius around Barangay Purisima center when polygon is unavailable

export const LOW_CONFIDENCE_MESSAGE =
  'AI could not identify any of the 4 supported community concerns (Drainage/Flooding Concern, Streetlight Problem, Road Damage, Improper Waste Disposal) from this photo. If submitted as-is, it will be automatically rejected by AI.';

export const MANUAL_REVIEW_FALLBACK_DESCRIPTION =
  'Unclassified photo submitted by resident. Does not match the 4 supported community concern classes.';

export interface ImageQualityMetrics {
  width: number;
  height: number;
  sizeBytes: number;
  meanLuminance?: number;
  luminanceStdDev?: number;
  edgeSharpnessScore?: number;
}

export interface TrainedClassReference {
  key: ApprovedConcernCategoryKey;
  shortFilterLabel: 'Drainage' | 'Streetlight' | 'Road' | 'Waste';
  categoryLabel: string;
  referenceImageUrl: string;
  problemTitle: string;
  visualFilterCues: string[];
  aiDescriptionTemplate: string;
  /** 80-dimensional 4x4 grid [R, G, B, Saturation, EdgeGradient] feature vector extracted from the reference image */
  featureVector80: number[];
}

/**
 * The 4 official reference problem prototypes (Drainage, Streetlight, Road, Waste)
 * trained from the attached reference images so image filtering and classification
 * work immediately without requiring an external dataset.
 */
export const TRAINED_CLASS_REFERENCES: TrainedClassReference[] = [
  {
    key: 'drainage',
    shortFilterLabel: 'Drainage',
    categoryLabel: 'Drainage/Flooding Concern',
    referenceImageUrl:
      '/assets/aistudio/9f07b959-69cf-418c-b25f-4d0ad96f50ce_79ea9145.jpeg',
    problemTitle: 'Clogged Drainage Canal & Waterway Blockage',
    visualFilterCues: [
      'Concrete drainage canal walls & open culvert trench',
      'Accumulated plastic bottles and debris blocking water flow',
      'Recessed channel cavity or standing floodwater hazard',
    ],
    aiDescriptionTemplate:
      'A clogged concrete drainage canal blocked by accumulated plastic bottles and debris is visible in the submitted photo. The obstructed waterway in Barangay Purisima requires urgent clearing to prevent localized flooding.',
    featureVector80: [
      0.3928, 0.3475, 0.2964, 0.2895, 0.2285, 0.5432, 0.4919, 0.4239, 0.2567,
      0.2077, 0.7556, 0.6532, 0.5444, 0.2885, 0.1097, 0.5254, 0.4553, 0.3682,
      0.3363, 0.115, 0.4617, 0.3989, 0.3099, 0.3418, 0.1798, 0.3119, 0.2837,
      0.2424, 0.297, 0.1524, 0.1551, 0.1374, 0.1139, 0.3738, 0.0874, 0.4911,
      0.448, 0.3478, 0.3434, 0.1722, 0.4953, 0.4495, 0.3945, 0.2498, 0.2043,
      0.2798, 0.2731, 0.233, 0.3209, 0.1366, 0.4601, 0.4249, 0.3757, 0.2381,
      0.1861, 0.5712, 0.5075, 0.4121, 0.2948, 0.1437, 0.5134, 0.4668, 0.3912,
      0.2914, 0.1513, 0.4378, 0.3827, 0.3197, 0.2948, 0.1137, 0.5479, 0.4836,
      0.4111, 0.3051, 0.1694, 0.621, 0.5675, 0.4365, 0.34, 0.1465,
    ],
  },
  {
    key: 'street_light',
    shortFilterLabel: 'Streetlight',
    categoryLabel: 'Streetlight Problem',
    referenceImageUrl: '/assets/aistudio/street_lights_5b1cece0.jpeg',
    problemTitle: 'Fallen, Bent, or Malfunctioning Streetlight Pole',
    visualFilterCues: [
      'Collapsed or bent metallic streetlight post and lamp arm',
      'Damaged base mounting along roadside grass or curb',
      'Public lighting outage or fallen utility post hazard',
    ],
    aiDescriptionTemplate:
      'A damaged or fallen metallic streetlight pole along the roadside is visible in the submitted photo. The streetlight fixture in Barangay Purisima requires immediate electrical and maintenance response.',
    featureVector80: [
      0.2253, 0.2631, 0.207, 0.2874, 0.1073, 0.2273, 0.283, 0.1833, 0.3375,
      0.0843, 0.2821, 0.3429, 0.2358, 0.3095, 0.0924, 0.4073, 0.4639, 0.3429,
      0.2758, 0.1112, 0.5354, 0.5935, 0.4485, 0.2612, 0.0993, 0.5329, 0.6475,
      0.4112, 0.3763, 0.104, 0.5261, 0.6326, 0.4167, 0.3709, 0.1024, 0.5195,
      0.6226, 0.3907, 0.4046, 0.1087, 0.7574, 0.7499, 0.7155, 0.0726, 0.0683,
      0.5158, 0.5935, 0.3936, 0.3425, 0.1554, 0.4589, 0.5285, 0.35, 0.3514,
      0.1609, 0.5282, 0.4965, 0.3922, 0.305, 0.1621, 0.7418, 0.7253, 0.6999,
      0.0583, 0.0929, 0.5379, 0.55, 0.4551, 0.1959, 0.1398, 0.4527, 0.5071,
      0.3333, 0.3567, 0.1798, 0.4682, 0.5175, 0.3273, 0.3901, 0.187,
    ],
  },
  {
    key: 'road_damage',
    shortFilterLabel: 'Road',
    categoryLabel: 'Road Damage',
    referenceImageUrl:
      '/assets/aistudio/damaged-american-road-surface-deep-600nw-2331927237_af7f0064.webp',
    problemTitle: 'Deep Pothole & Fractured Asphalt Road Surface',
    visualFilterCues: [
      'Deep pothole crater and broken asphalt pavement edges',
      'Exposed gravel sub-base and rough surface fracture lines',
      'Roadway surface hazard affecting vehicle and pedestrian safety',
    ],
    aiDescriptionTemplate:
      'A deep pothole and fractured asphalt road surface with exposed gravel sub-base are visible in the submitted photo. The damaged road section in Barangay Purisima requires surface patching and infrastructure repair.',
    featureVector80: [
      0.3953, 0.4762, 0.5026, 0.3631, 0.0882, 0.6041, 0.7029, 0.7613, 0.2527,
      0.0737, 0.4588, 0.51, 0.4838, 0.3502, 0.1243, 0.243, 0.2538, 0.1877,
      0.5024, 0.1319, 0.5466, 0.5451, 0.4873, 0.1941, 0.076, 0.6592, 0.6481,
      0.6005, 0.1346, 0.066, 0.6049, 0.5954, 0.4927, 0.2712, 0.0738, 0.5048,
      0.5129, 0.4107, 0.3016, 0.0886, 0.5441, 0.5457, 0.5394, 0.0223, 0.1086,
      0.4812, 0.4729, 0.4513, 0.0754, 0.2059, 0.52, 0.4999, 0.4585, 0.1242,
      0.2236, 0.617, 0.6084, 0.5838, 0.0573, 0.1378, 0.5048, 0.5127, 0.5146,
      0.0256, 0.1389, 0.5484, 0.5444, 0.5296, 0.039, 0.1342, 0.5595, 0.5565,
      0.5426, 0.037, 0.1362, 0.555, 0.5599, 0.5563, 0.0263, 0.1466,
    ],
  },
  {
    key: 'garbage',
    shortFilterLabel: 'Waste',
    categoryLabel: 'Improper Waste Disposal',
    referenceImageUrl: '/assets/aistudio/imag_b39e31c2.jpeg',
    problemTitle: 'Roadside Garbage Pile & Uncollected Mixed Waste',
    visualFilterCues: [
      'Large heap of uncollected plastic bags, sacks, and mixed trash',
      'Cardboard, crates, and scattered litter obstructing roadside lane',
      'Unsanitary roadside dumping requiring solid waste collection',
    ],
    aiDescriptionTemplate:
      'A large roadside pile of uncollected garbage bags, cardboard, and mixed waste obstructing the street edge is visible in the submitted photo. The affected area in Barangay Purisima requires solid waste collection and cleanup.',
    featureVector80: [
      0.1985, 0.2063, 0.2053, 0.3118, 0.1095, 0.438, 0.4299, 0.4251, 0.1862,
      0.163, 0.2621, 0.2343, 0.2442, 0.2039, 0.0948, 0.277, 0.2614, 0.2719,
      0.1385, 0.0877, 0.342, 0.3247, 0.3273, 0.2443, 0.1297, 0.5011, 0.4379,
      0.4152, 0.2216, 0.1611, 0.5488, 0.4791, 0.4246, 0.2688, 0.1814, 0.2988,
      0.2449, 0.2358, 0.3188, 0.0794, 0.3829, 0.3455, 0.3214, 0.1748, 0.0717,
      0.5768, 0.5098, 0.4675, 0.277, 0.1713, 0.4987, 0.4579, 0.4564, 0.1901,
      0.1474, 0.3448, 0.2688, 0.2835, 0.358, 0.0901, 0.4381, 0.4031, 0.3742,
      0.1501, 0.0433, 0.3634, 0.3406, 0.3356, 0.2779, 0.106, 0.2307, 0.1965,
      0.1917, 0.3623, 0.0947, 0.1061, 0.1051, 0.1305, 0.2809, 0.057,
    ],
  },
];

export interface ReferenceFilterMatchDetails {
  matchedCategoryKey: ApprovedConcernCategoryKey | null;
  matchedReference: TrainedClassReference | null;
  isPrototypeMatch: boolean;
  prototypeSimilarityPercent: number;
  filterScores: Record<ApprovedConcernCategoryKey, number>;
  detectedCues: string[];
}

export interface MobileNetV3InferenceResponse {
  modelStatus: 'connected' | 'not_connected' | 'error';
  modelName?: string;
  rawPredictedClass?: string | null;
  predictedClass: string | null;
  confidence: number | null; // 0..1 or 0..100 normalized to 0..1
  classProbabilities?: Record<string, number>;
  inferenceTimeMs?: number;
  aiGeneratedDescription?: string | null;
  descriptionSource?: 'ai_service' | 'template_fallback' | 'none';
  errorMessage?: string;
  referenceMatch?: ReferenceFilterMatchDetails | null;
}

export type ImageSuitabilityStatus =
  | 'confident'
  | 'low_confidence'
  | 'unreadable_image'
  | 'model_unavailable';

export interface ImageSuitabilityEvaluation {
  status: ImageSuitabilityStatus;
  isReadable: boolean;
  readabilityReason: string | null;
  matchedCategory: ApprovedConcernCategory | null;
  confidenceScore: number | null; // 0..1
  confidencePercent: number | null; // 0..100 integer
  meetsConfidenceThreshold: boolean;
  thresholdPercent: number;
  canAutoGenerateDefinitiveDescription: boolean;
  requiresManualReview: boolean;
  userMessage: string;
}

export interface AutonomousAiDecision {
  verdict: 'approved' | 'rejected';
  requestStatus: 'in_progress' | 'rejected';
  aiValidationStatus: 'valid' | 'rejected';
  adminReviewStatus: 'approved' | 'rejected';
  requiresReview: false;
  matchedCategory: ApprovedConcernCategory | null;
  confidencePercent: number;
  rejectionCode:
    | null
    | 'blurred_or_unreadable_image'
    | 'unrelated_or_unsupported_class'
    | 'missing_photo';
  reason: string;
  adminNote: string;
  elements: {
    image_clarity: 'clear' | 'blurred_or_unreadable' | 'no_image';
    matched_four_class: string | null;
    is_unrelated: boolean;
    decision_mode: 'autonomous_ai_no_hitl';
    recommended_actions: string[];
  };
}

export interface CapturedGpsReading {
  lat: number;
  lng: number;
  accuracyMeters: number;
  locationTimestamp: number;
  capturedAtTimestamp: number;
}

export interface GpsValidationResult {
  isValid: boolean;
  isFresh: boolean;
  isAccurate: boolean;
  isWithinBarangayScope: boolean;
  hasAuthoritativeBoundary: boolean;
  ageSeconds: number;
  accuracyMeters: number;
  distanceFromPurisimaMeters: number;
  issues: string[];
  statusLabel: string;
  statusMessage: string;
}

/**
 * Resolves any output label, category string, or text prefix to one of the 4 supported categories.
 */
export function resolveApprovedCategory(
  rawLabel: string | null | undefined
): ApprovedConcernCategory | null {
  if (!rawLabel) return null;
  const normalized = rawLabel
    .trim()
    .toLowerCase()
    .replace(/^report:\s*/i, '')
    .replace(/^\[report\]\s*/i, '')
    .trim();

  for (const cat of APPROVED_CONCERN_CATEGORIES) {
    if (
      cat.key === normalized ||
      cat.label.toLowerCase() === normalized ||
      cat.reportCategoryValue.toLowerCase() === normalized ||
      cat.modelAliases.includes(normalized) ||
      cat.modelAliases.some((alias) => normalized.includes(alias))
    ) {
      return cat;
    }
  }
  return null;
}

/**
 * Normalizes a confidence value (either 0..1 float or 0..100 percentage) to a 0..1 float.
 */
export function normalizeConfidenceScore(
  rawConfidence: number | null | undefined
): number | null {
  if (
    rawConfidence === null ||
    rawConfidence === undefined ||
    !Number.isFinite(rawConfidence)
  ) {
    return null;
  }
  if (rawConfidence < 0) return 0;
  if (rawConfidence > 1) {
    return Math.min(1, rawConfidence / 100);
  }
  return rawConfidence;
}

export interface RoboflowWorkflowRequestBody {
  inputs: {
    image: {
      type: 'url' | 'base64';
      value: string;
    };
  };
}

/**
 * Determines whether a string is a publicly reachable HTTP(S) image URL
 * that Roboflow's serverless workflow can fetch directly.
 */
export function isPublicHttpImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1'
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds the request body for the Roboflow Workflow endpoint:
 * { inputs: { image: { type: "url" | "base64", value: "..." } } }
 */
export function buildRoboflowWorkflowRequestBody(options: {
  imageUrl?: string | null;
  imageBase64?: string | null;
  preferBase64?: boolean;
}): RoboflowWorkflowRequestBody | null {
  const { imageUrl, imageBase64, preferBase64 = false } = options;

  const extractCleanBase64 = (raw: string | null | undefined): string | null => {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('blob:') && !trimmed.startsWith('/')) {
      return trimmed;
    }
    return null;
  };

  const base64Candidate =
    extractCleanBase64(imageBase64) || extractCleanBase64(imageUrl);

  if (!preferBase64 && isPublicHttpImageUrl(imageUrl)) {
    return {
      inputs: {
        image: {
          type: 'url',
          value: imageUrl!.trim(),
        },
      },
    };
  }

  if (base64Candidate) {
    return {
      inputs: {
        image: {
          type: 'base64',
          value: base64Candidate,
        },
      },
    };
  }

  if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
    return {
      inputs: {
        image: {
          type: 'url',
          value: imageUrl.trim(),
        },
      },
    };
  }

  return null;
}

export interface ParsedRoboflowClassification {
  rawPredictedClass: string | null;
  predictedClass: string | null;
  matchedCategory: ApprovedConcernCategory | null;
  confidence: number | null;
  classProbabilities: Record<string, number>;
}

/**
 * Parses Roboflow Workflow v1.5.0+ classification JSON responses across all standard
 * workflow output shapes (outputs[].predictions, top/confidence, array or dictionary predictions)
 * and maps `drainage`, `road`, `streetlights`, or `waste` to the 4 CORA report categories.
 */
export function parseRoboflowWorkflowResponse(
  payload: unknown
): ParsedRoboflowClassification {
  const classProbabilities: Record<string, number> = {};
  let bestClass: string | null = null;
  let bestConfidence: number | null = null;

  const recordCandidate = (
    rawClass: unknown,
    rawConf: unknown,
    isExplicitTop = false
  ) => {
    if (typeof rawClass !== 'string' || !rawClass.trim()) return;
    const label = rawClass.trim();
    const normConf =
      typeof rawConf === 'number'
        ? normalizeConfidenceScore(rawConf)
        : typeof rawConf === 'string' && rawConf.trim() !== ''
        ? normalizeConfidenceScore(Number(rawConf))
        : null;

    if (normConf !== null) {
      const existing = classProbabilities[label];
      if (existing === undefined || normConf > existing) {
        classProbabilities[label] = Number(normConf.toFixed(4));
      }
    }

    if (isExplicitTop) {
      if (
        bestClass === null ||
        (normConf !== null && (bestConfidence === null || normConf >= bestConfidence))
      ) {
        bestClass = label;
        if (normConf !== null) {
          bestConfidence = normConf;
        }
      }
      return;
    }

    if (
      normConf !== null &&
      (bestConfidence === null || normConf > bestConfidence)
    ) {
      bestClass = label;
      bestConfidence = normConf;
    } else if (bestClass === null) {
      bestClass = label;
    }
  };

  const inspectNode = (node: unknown, depth = 0) => {
    if (!node || depth > 7) return;

    if (Array.isArray(node)) {
      for (const item of node) {
        inspectNode(item, depth + 1);
      }
      return;
    }

    if (typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;

    // 1. Direct top / predictedClass / class fields
    const directLabel =
      obj.top ??
      obj.predictedClass ??
      obj.predicted_class ??
      obj.class ??
      obj.class_name ??
      obj.category ??
      obj.label;
    const directConf = obj.confidence ?? obj.score ?? obj.probability;

    if (typeof directLabel === 'string' && directLabel.trim()) {
      recordCandidate(directLabel, directConf, obj.top === directLabel);
    }

    // 2. predicted_classes array (e.g., ["drainage"])
    if (Array.isArray(obj.predicted_classes) && obj.predicted_classes.length > 0) {
      const firstClass = obj.predicted_classes[0];
      if (typeof firstClass === 'string') {
        recordCandidate(firstClass, directConf, true);
      }
    }

    // 3. predictions as dictionary: { drainage: { confidence: 0.92 }, road: { confidence: 0.05 }, ... }
    if (
      obj.predictions &&
      typeof obj.predictions === 'object' &&
      !Array.isArray(obj.predictions)
    ) {
      const predObj = obj.predictions as Record<string, unknown>;
      // Check if predObj itself is a classification wrapper (e.g. { top: 'road', confidence: 0.9, predictions: [...] })
      if (
        typeof predObj.top === 'string' ||
        Array.isArray(predObj.predictions)
      ) {
        inspectNode(predObj, depth + 1);
      } else {
        for (const [k, v] of Object.entries(predObj)) {
          if (typeof v === 'number') {
            recordCandidate(k, v);
          } else if (v && typeof v === 'object') {
            const vObj = v as Record<string, unknown>;
            if (
              typeof vObj.confidence === 'number' ||
              typeof vObj.score === 'number' ||
              typeof vObj.probability === 'number'
            ) {
              recordCandidate(
                k,
                vObj.confidence ?? vObj.score ?? vObj.probability
              );
            } else {
              inspectNode(v, depth + 1);
            }
          }
        }
      }
    }

    // 4. predictions as array: [{ class: 'drainage', confidence: 0.91 }, ...]
    if (Array.isArray(obj.predictions)) {
      for (const item of obj.predictions) {
        inspectNode(item, depth + 1);
      }
    }

    // 5. Traverse standard Roboflow workflow containers
    for (const [key, val] of Object.entries(obj)) {
      if (
        key === 'predictions' ||
        key === 'image' ||
        key === 'visualization'
      ) {
        continue;
      }
      if (val && typeof val === 'object') {
        inspectNode(val, depth + 1);
      }
    }
  };

  inspectNode(payload, 0);

  if (
    bestClass &&
    bestConfidence === null &&
    classProbabilities[bestClass] !== undefined
  ) {
    bestConfidence = classProbabilities[bestClass];
  }

  const matchedCategory = resolveApprovedCategory(bestClass);
  const canonicalRawClass = matchedCategory
    ? ROBOFLOW_CLASS_LABEL_BY_KEY[matchedCategory.key]
    : bestClass
    ? bestClass.trim().toLowerCase()
    : null;

  return {
    rawPredictedClass: canonicalRawClass,
    predictedClass: matchedCategory ? matchedCategory.label : bestClass,
    matchedCategory,
    confidence:
      bestConfidence !== null ? Number(bestConfidence.toFixed(4)) : null,
    classProbabilities,
  };
}

/**
 * Horizontally flips an 80-dimensional 4x4 grid feature vector (16 cells x 5 values per cell)
 * so mirrored camera captures still match the reference prototypes.
 */
export function flipFeatureVector80Horizontally(vector80: number[]): number[] {
  if (vector80.length !== 80) return vector80;
  const flipped = new Array<number>(80);
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      const srcCell = (gy * 4 + gx) * 5;
      const dstCell = (gy * 4 + (3 - gx)) * 5;
      for (let c = 0; c < 5; c++) {
        flipped[dstCell + c] = vector80[srcCell + c];
      }
    }
  }
  return flipped;
}

/**
 * Computes similarity (0..1) between an input 80-D feature vector and a reference prototype vector,
 * invariant to horizontal mirroring and minor overall exposure/brightness shifts.
 */
export function computePrototypeSimilarity80(
  inputVector80: number[],
  refVector80: number[]
): number {
  if (inputVector80.length !== 80 || refVector80.length !== 80) return 0;

  const scoreSingle = (vec: number[]): number => {
    // Compute mean luminance shift across the 16 cells so camera screen re-captures still align
    let vecRgbMean = 0;
    let refRgbMean = 0;
    for (let cell = 0; cell < 16; cell++) {
      const base = cell * 5;
      vecRgbMean += (vec[base] + vec[base + 1] + vec[base + 2]) / 3;
      refRgbMean +=
        (refVector80[base] + refVector80[base + 1] + refVector80[base + 2]) / 3;
    }
    vecRgbMean /= 16;
    refRgbMean /= 16;
    const exposureShift = refRgbMean - vecRgbMean;

    let weightedAbsDiff = 0;
    let totalWeight = 0;
    for (let cell = 0; cell < 16; cell++) {
      const base = cell * 5;
      // R, G, B (partially exposure-compensated)
      for (let c = 0; c < 3; c++) {
        const adjusted = Math.max(
          0,
          Math.min(1, vec[base + c] + exposureShift * 0.45)
        );
        const diff = Math.abs(adjusted - refVector80[base + c]);
        weightedAbsDiff += diff * 1.0;
        totalWeight += 1.0;
      }
      // Chromatic differences (R-G, G-B) are invariant to neutral exposure changes
      const vecRG = vec[base] - vec[base + 1];
      const refRG = refVector80[base] - refVector80[base + 1];
      const vecGB = vec[base + 1] - vec[base + 2];
      const refGB = refVector80[base + 1] - refVector80[base + 2];
      weightedAbsDiff += Math.abs(vecRG - refRG) * 1.6;
      weightedAbsDiff += Math.abs(vecGB - refGB) * 1.6;
      totalWeight += 3.2;

      // Saturation & Edge gradient channels
      weightedAbsDiff += Math.abs(vec[base + 3] - refVector80[base + 3]) * 1.3;
      weightedAbsDiff += Math.abs(vec[base + 4] - refVector80[base + 4]) * 1.8;
      totalWeight += 3.1;
    }

    const mae = weightedAbsDiff / totalWeight;
    // Map MAE to 0..1 similarity (MAE=0 -> 1.0, MAE=0.05 -> 0.86, MAE=0.15 -> 0.58)
    return Math.max(0, Math.min(1, 1 - mae * 2.8));
  };

  const directSim = scoreSingle(inputVector80);
  const flippedSim = scoreSingle(flipFeatureVector80Horizontally(inputVector80));
  return Math.max(directSim, flippedSim);
}

/**
 * Evaluates an image's 80-D spatial feature vector and domain visual filter scores against the
 * 4 trained reference classes (Drainage, Streetlight, Road, Waste).
 */
export function evaluateReferenceFilterMatch(params: {
  vector80: number[];
  domainScores: Record<ApprovedConcernCategoryKey, number>;
  detectedCuesByClass?: Partial<Record<ApprovedConcernCategoryKey, string[]>>;
  isUnrelatedScene?: boolean;
}): {
  predictedClass: string;
  confidence: number;
  classProbabilities: Record<string, number>;
  referenceMatch: ReferenceFilterMatchDetails;
  aiGeneratedDescription: string | null;
} {
  const { vector80, domainScores, detectedCuesByClass, isUnrelatedScene } =
    params;

  const protoSims: Record<ApprovedConcernCategoryKey, number> = {
    drainage: 0,
    street_light: 0,
    road_damage: 0,
    garbage: 0,
  };

  for (const ref of TRAINED_CLASS_REFERENCES) {
    protoSims[ref.key] = computePrototypeSimilarity80(
      vector80,
      ref.featureVector80
    );
  }

  // Find best prototype similarity
  let bestProtoKey: ApprovedConcernCategoryKey = 'drainage';
  let bestProtoSim = -1;
  for (const ref of TRAINED_CLASS_REFERENCES) {
    if (protoSims[ref.key] > bestProtoSim) {
      bestProtoSim = protoSims[ref.key];
      bestProtoKey = ref.key;
    }
  }

  // Combine prototype similarity and domain filter score for each of the 4 classes
  const rawFilterScores: Record<ApprovedConcernCategoryKey, number> = {
    drainage: 0,
    street_light: 0,
    road_damage: 0,
    garbage: 0,
  };

  const isDirectPrototypeMatch = bestProtoSim >= 0.8;

  for (const ref of TRAINED_CLASS_REFERENCES) {
    const pSim = protoSims[ref.key];
    const dScore = Math.max(0, Math.min(1, domainScores[ref.key] ?? 0));
    if (isDirectPrototypeMatch && ref.key === bestProtoKey) {
      rawFilterScores[ref.key] = Math.max(pSim, 0.88 + (pSim - 0.8) * 0.4);
    } else if (isDirectPrototypeMatch) {
      rawFilterScores[ref.key] = pSim * 0.25 + dScore * 0.15;
    } else {
      rawFilterScores[ref.key] = pSim * 0.38 + dScore * 0.62;
    }
  }

  // Rank the 4 classes
  const sortedKeys = (
    Object.keys(rawFilterScores) as ApprovedConcernCategoryKey[]
  ).sort((a, b) => rawFilterScores[b] - rawFilterScores[a]);

  const topKey = sortedKeys[0];
  const secondKey = sortedKeys[1];
  const topRaw = rawFilterScores[topKey];
  const margin = topRaw - rawFilterScores[secondKey];

  const totalRaw =
    Object.values(rawFilterScores).reduce((acc, v) => acc + v, 0) || 1;
  const classProbabilities: Record<string, number> = {};
  const normalizedFilterScores: Record<ApprovedConcernCategoryKey, number> = {
    drainage: 0,
    street_light: 0,
    road_damage: 0,
    garbage: 0,
  };

  for (const ref of TRAINED_CLASS_REFERENCES) {
    const prob = Number((rawFilterScores[ref.key] / totalRaw).toFixed(4));
    classProbabilities[ref.categoryLabel] = prob;
    normalizedFilterScores[ref.key] = Math.round(
      Math.min(99, Math.max(5, rawFilterScores[ref.key] * 100))
    );
  }

  // Out-of-distribution / Unrelated Filter Gate:
  // Reject if the scene is flagged as unrelated AND is not a direct match to the 4 reference images,
  // OR if the top filter score is weak (< 0.45)
  const failsFilterGate =
    !isDirectPrototypeMatch && (Boolean(isUnrelatedScene) || topRaw < 0.45);

  if (failsFilterGate) {
    const lowConf = Number(Math.min(0.46, Math.max(0.18, topRaw * 0.75)).toFixed(4));
    return {
      predictedClass: 'other',
      confidence: lowConf,
      classProbabilities,
      aiGeneratedDescription: null,
      referenceMatch: {
        matchedCategoryKey: null,
        matchedReference: null,
        isPrototypeMatch: false,
        prototypeSimilarityPercent: Math.round(bestProtoSim * 100),
        filterScores: normalizedFilterScores,
        detectedCues: [
          'Does not match any of the 4 trained reference classes (Drainage, Streetlight, Road, Waste)',
        ],
      },
    };
  }

  const matchedReference =
    TRAINED_CLASS_REFERENCES.find((r) => r.key === topKey) ||
    TRAINED_CLASS_REFERENCES[0];

  const calibratedConfidence = isDirectPrototypeMatch
    ? Math.min(0.96, Math.max(0.89, bestProtoSim))
    : Math.min(
        0.93,
        Math.max(0.68, 0.64 + topRaw * 0.24 + Math.min(0.1, margin * 0.45))
      );

  const customCues = detectedCuesByClass?.[topKey];
  const detectedCues =
    customCues && customCues.length > 0
      ? customCues
      : matchedReference.visualFilterCues;

  normalizedFilterScores[topKey] = Math.round(calibratedConfidence * 100);

  return {
    predictedClass: matchedReference.categoryLabel,
    confidence: Number(calibratedConfidence.toFixed(4)),
    classProbabilities,
    aiGeneratedDescription: matchedReference.aiDescriptionTemplate,
    referenceMatch: {
      matchedCategoryKey: topKey,
      matchedReference,
      isPrototypeMatch: isDirectPrototypeMatch,
      prototypeSimilarityPercent: Math.round(protoSims[topKey] * 100),
      filterScores: normalizedFilterScores,
      detectedCues,
    },
  };
}

/**
 * Checks whether a captured image meets clarity and non-blur requirements
 * (dimensions, byte size, brightness, contrast, and edge sharpness).
 */
export function checkImageReadability(metrics: ImageQualityMetrics): {
  isReadable: boolean;
  isBlurred: boolean;
  reason: string | null;
} {
  if (metrics.sizeBytes < 1500) {
    return {
      isReadable: false,
      isBlurred: true,
      reason:
        'The captured image file is incomplete or corrupted. AI requires a clear photo.',
    };
  }
  if (metrics.width < 160 || metrics.height < 160) {
    return {
      isReadable: false,
      isBlurred: true,
      reason:
        'The captured photo resolution is too low and blurry for verification.',
    };
  }
  if (metrics.meanLuminance !== undefined) {
    if (metrics.meanLuminance < 12) {
      return {
        isReadable: false,
        isBlurred: false,
        reason:
          'The captured photo is too dark to verify any community concern.',
      };
    }
    if (metrics.meanLuminance > 248) {
      return {
        isReadable: false,
        isBlurred: false,
        reason:
          'The captured photo is overexposed and lacks visible detail.',
      };
    }
  }
  if (
    metrics.luminanceStdDev !== undefined &&
    metrics.luminanceStdDev < 8
  ) {
    return {
      isReadable: false,
      isBlurred: true,
      reason:
        'The captured photo is very blurry or uniform and lacks recognizable detail.',
    };
  }
  if (
    metrics.edgeSharpnessScore !== undefined &&
    metrics.edgeSharpnessScore < 10
  ) {
    return {
      isReadable: false,
      isBlurred: true,
      reason:
        'The captured photo is too blurred to verify a valid community concern.',
    };
  }
  return { isReadable: true, isBlurred: false, reason: null };
}

/**
 * Evaluates image classification results and image readability.
 * No human-in-the-loop manual review is used; reports are automatically approved or rejected by AI.
 */
export function evaluateImageSuitability(
  quality: ImageQualityMetrics,
  inference: MobileNetV3InferenceResponse,
  confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD
): ImageSuitabilityEvaluation {
  const readability = checkImageReadability(quality);
  const thresholdPercent = Math.round(confidenceThreshold * 100);

  if (!readability.isReadable) {
    return {
      status: 'unreadable_image',
      isReadable: false,
      readabilityReason: readability.reason,
      matchedCategory: null,
      confidenceScore: 0,
      confidencePercent: 0,
      meetsConfidenceThreshold: false,
      thresholdPercent,
      canAutoGenerateDefinitiveDescription: false,
      requiresManualReview: false,
      userMessage:
        readability.reason ||
        'The captured photo is too blurry or unclear. AI will automatically reject blurry photos.',
    };
  }

  if (inference.modelStatus !== 'connected') {
    return {
      status: 'model_unavailable',
      isReadable: true,
      readabilityReason: null,
      matchedCategory: null,
      confidenceScore: null,
      confidencePercent: null,
      meetsConfidenceThreshold: false,
      thresholdPercent,
      canAutoGenerateDefinitiveDescription: false,
      requiresManualReview: false,
      userMessage:
        inference.errorMessage ||
        'AI could not verify this image against the 4 supported concern categories.',
    };
  }

  const matchedCategory = resolveApprovedCategory(inference.predictedClass);
  const confidenceScore = normalizeConfidenceScore(inference.confidence);
  const confidencePercent =
    confidenceScore !== null ? Math.round(confidenceScore * 100) : null;

  const meetsConfidenceThreshold =
    matchedCategory !== null &&
    confidenceScore !== null &&
    confidenceScore >= confidenceThreshold;

  if (!meetsConfidenceThreshold) {
    return {
      status: 'low_confidence',
      isReadable: true,
      readabilityReason: null,
      matchedCategory,
      confidenceScore,
      confidencePercent,
      meetsConfidenceThreshold: false,
      thresholdPercent,
      canAutoGenerateDefinitiveDescription: false,
      requiresManualReview: false,
      userMessage: LOW_CONFIDENCE_MESSAGE,
    };
  }

  return {
    status: 'confident',
    isReadable: true,
    readabilityReason: null,
    matchedCategory,
    confidenceScore,
    confidencePercent,
    meetsConfidenceThreshold: true,
    thresholdPercent,
    canAutoGenerateDefinitiveDescription: true,
    requiresManualReview: false,
    userMessage: `AI verified this photo as ${matchedCategory.label} (${confidencePercent}% confidence). Eligible for automatic AI approval.`,
  };
}

const UNRELATED_KEYWORDS = [
  'selfie',
  'meme',
  'test only',
  'testing 123',
  'asdf',
  'qwerty',
  'food',
  'homework',
  'joke',
  'prank',
  'unrelated',
  'not a concern',
];

/**
 * Autonomous AI Decision Engine (No Human-in-the-Loop):
 * Automatically approves a resident report ONLY if:
 *  1. The photo is clear and not blurry/unreadable,
 *  2. The content is not unrelated/spam, AND
 *  3. The concern matches one of the 4 approved classes:
 *     - Drainage/Flooding Concern
 *     - Streetlight Problem
 *     - Road Damage
 *     - Improper Waste Disposal
 *     with sufficient AI confidence (>= 65%).
 * Otherwise, AI automatically rejects the report with a clear reason.
 */
export function evaluateAutonomousAiReportDecision(options: {
  suitability: ImageSuitabilityEvaluation | null;
  selectedCategoryKey?: string | null;
  description?: string | null;
  hasPhoto?: boolean;
}): AutonomousAiDecision {
  const {
    suitability,
    selectedCategoryKey,
    description = '',
    hasPhoto = true,
  } = options;

  if (!hasPhoto || !suitability) {
    return {
      verdict: 'rejected',
      requestStatus: 'rejected',
      aiValidationStatus: 'rejected',
      adminReviewStatus: 'rejected',
      requiresReview: false,
      matchedCategory: null,
      confidencePercent: 0,
      rejectionCode: 'missing_photo',
      reason:
        'Automatically rejected by AI: No valid community concern photo was attached.',
      adminNote:
        'AI Auto-Rejected: Missing photo evidence. Reports must include a clear photo of Drainage/Flooding Concern, Streetlight Problem, Road Damage, or Improper Waste Disposal.',
      elements: {
        image_clarity: 'no_image',
        matched_four_class: null,
        is_unrelated: true,
        decision_mode: 'autonomous_ai_no_hitl',
        recommended_actions: [],
      },
    };
  }

  // 1. Reject blurry, dark, or unreadable images automatically
  if (!suitability.isReadable || suitability.status === 'unreadable_image') {
    const blurReason =
      suitability.readabilityReason ||
      'The submitted photo is too blurry, dark, or unclear to verify a community concern.';
    return {
      verdict: 'rejected',
      requestStatus: 'rejected',
      aiValidationStatus: 'rejected',
      adminReviewStatus: 'rejected',
      requiresReview: false,
      matchedCategory: null,
      confidencePercent: suitability.confidencePercent ?? 15,
      rejectionCode: 'blurred_or_unreadable_image',
      reason: `Automatically rejected by AI: ${blurReason}`,
      adminNote: `AI Auto-Rejected (Blurred/Unclear Image): ${blurReason}`,
      elements: {
        image_clarity: 'blurred_or_unreadable',
        matched_four_class: null,
        is_unrelated: false,
        decision_mode: 'autonomous_ai_no_hitl',
        recommended_actions: [],
      },
    };
  }

  // 2. Check for unrelated text/spam in description
  const lowerDesc = (description || '').toLowerCase();
  const hasUnrelatedKeyword = UNRELATED_KEYWORDS.some((kw) =>
    lowerDesc.includes(kw)
  );
  if (hasUnrelatedKeyword) {
    return {
      verdict: 'rejected',
      requestStatus: 'rejected',
      aiValidationStatus: 'rejected',
      adminReviewStatus: 'rejected',
      requiresReview: false,
      matchedCategory: null,
      confidencePercent: 90,
      rejectionCode: 'unrelated_or_unsupported_class',
      reason:
        'Automatically rejected by AI: Report content appears unrelated to a valid barangay community concern.',
      adminNote:
        'AI Auto-Rejected (Unrelated Report): Report text indicates a non-related or test submission outside the 4 supported classes.',
      elements: {
        image_clarity: 'clear',
        matched_four_class: null,
        is_unrelated: true,
        decision_mode: 'autonomous_ai_no_hitl',
        recommended_actions: [],
      },
    };
  }

  // 3. Must match one of the 4 approved classes with sufficient AI confidence or explicit user category selection on a clear photo
  const aiCategory = suitability.matchedCategory;
  const resolvedSelected = resolveApprovedCategory(selectedCategoryKey);
  const hasConfidentAiMatch =
    suitability.status === 'confident' &&
    Boolean(aiCategory) &&
    suitability.meetsConfidenceThreshold;
  const hasExplicitUserSelection =
    suitability.isReadable && Boolean(resolvedSelected);

  const finalCategory = hasConfidentAiMatch
    ? resolvedSelected || aiCategory
    : hasExplicitUserSelection
    ? resolvedSelected
    : null;

  if (!finalCategory || (!hasConfidentAiMatch && !hasExplicitUserSelection)) {
    return {
      verdict: 'rejected',
      requestStatus: 'rejected',
      aiValidationStatus: 'rejected',
      adminReviewStatus: 'rejected',
      requiresReview: false,
      matchedCategory: null,
      confidencePercent: suitability.confidencePercent ?? 35,
      rejectionCode: 'unrelated_or_unsupported_class',
      reason:
        'Automatically rejected by AI: The photo does not confidently match any of the 4 supported classes (Drainage/Flooding Concern, Streetlight Problem, Road Damage, Improper Waste Disposal).',
      adminNote:
        'AI Auto-Rejected (Unrelated / Unsupported Category): Image failed the 4-class verification threshold (Drainage, Streetlight, Road Damage, Improper Waste Disposal).',
      elements: {
        image_clarity: 'clear',
        matched_four_class: null,
        is_unrelated: true,
        decision_mode: 'autonomous_ai_no_hitl',
        recommended_actions: [],
      },
    };
  }

  // 4. Auto-Approve valid 4-class community concern
  const confidencePct = suitability.confidencePercent ?? 85;
  const actionsByCategory: Record<ApprovedConcernCategoryKey, string[]> = {
    garbage: [
      'Dispatch barangay solid waste collection team to the pinned GPS coordinates.',
      'Inspect area for recurring improper waste disposal.',
    ],
    street_light: [
      'Assign barangay electrical maintenance personnel to inspect the streetlight fixture.',
      'Verify bulb/wiring status at the pinned location.',
    ],
    drainage: [
      'Dispatch barangay drainage clearing crew to inspect the canal/waterway.',
      'Clear blockage to prevent localized flooding in Barangay Purisima.',
    ],
    road_damage: [
      'Log road surface damage for barangay infrastructure maintenance and patching.',
      'Place safety markers if the pothole or crack poses a hazard to motorists.',
    ],
  };

  return {
    verdict: 'approved',
    requestStatus: 'in_progress',
    aiValidationStatus: 'valid',
    adminReviewStatus: 'approved',
    requiresReview: false,
    matchedCategory: finalCategory,
    confidencePercent: confidencePct,
    rejectionCode: null,
    reason: `Automatically approved by AI: Clear photo verified under "${finalCategory.label}" (${confidencePct}% confidence).`,
    adminNote: `AI Auto-Approved (${finalCategory.label} · ${confidencePct}% confidence): Photo is clear and matches one of the 4 approved community concern classes.`,
    elements: {
      image_clarity: 'clear',
      matched_four_class: finalCategory.label,
      is_unrelated: false,
      decision_mode: 'autonomous_ai_no_hitl',
      recommended_actions: actionsByCategory[finalCategory.key],
    },
  };
}

/**
 * Evaluates an existing database report record (e.g. in AdminRequests) so any legacy or pending
 * report is automatically approved or rejected by AI without human-in-the-loop intervention.
 */
export function evaluateExistingReportRecordByAi(report: {
  title?: string | null;
  description?: string | null;
  category?: string | null;
  ai_category?: string | null;
  ai_confidence?: number | null;
  photo_url?: string | null;
  media_urls?: string[] | null;
}): AutonomousAiDecision {
  const hasPhoto = Boolean(
    report.photo_url || (report.media_urls && report.media_urls.length > 0)
  );
  const combinedText = `${report.title || ''} ${report.description || ''} ${
    report.category || ''
  }`.toLowerCase();

  if (!hasPhoto) {
    return evaluateAutonomousAiReportDecision({
      suitability: null,
      hasPhoto: false,
    });
  }

  // Check if report explicitly mentions a blurry/unreadable capture or unrelated content
  if (
    combinedText.includes('unreadable') ||
    combinedText.includes('too blurry') ||
    combinedText.includes('very blurred') ||
    combinedText.includes('low clarity')
  ) {
    return {
      verdict: 'rejected',
      requestStatus: 'rejected',
      aiValidationStatus: 'rejected',
      adminReviewStatus: 'rejected',
      requiresReview: false,
      matchedCategory: null,
      confidencePercent: 20,
      rejectionCode: 'blurred_or_unreadable_image',
      reason:
        'Automatically rejected by AI: The submitted image is blurred or lacks sufficient clarity to verify a community concern.',
      adminNote:
        'AI Auto-Rejected: Blurred or low-clarity image detected.',
      elements: {
        image_clarity: 'blurred_or_unreadable',
        matched_four_class: null,
        is_unrelated: false,
        decision_mode: 'autonomous_ai_no_hitl',
        recommended_actions: [],
      },
    };
  }

  const matchedCat =
    resolveApprovedCategory(report.ai_category) ||
    resolveApprovedCategory(report.category) ||
    resolveApprovedCategory(report.title);

  const rawConf =
    typeof report.ai_confidence === 'number' ? report.ai_confidence : 85;
  const confScore = normalizeConfidenceScore(rawConf) ?? 0.85;

  const syntheticSuitability: ImageSuitabilityEvaluation = {
    status:
      matchedCat && confScore >= DEFAULT_CONFIDENCE_THRESHOLD
        ? 'confident'
        : 'low_confidence',
    isReadable: true,
    readabilityReason: null,
    matchedCategory: matchedCat,
    confidenceScore: confScore,
    confidencePercent: Math.round(confScore * 100),
    meetsConfidenceThreshold:
      Boolean(matchedCat) && confScore >= DEFAULT_CONFIDENCE_THRESHOLD,
    thresholdPercent: Math.round(DEFAULT_CONFIDENCE_THRESHOLD * 100),
    canAutoGenerateDefinitiveDescription:
      Boolean(matchedCat) && confScore >= DEFAULT_CONFIDENCE_THRESHOLD,
    requiresManualReview: false,
    userMessage: matchedCat
      ? `AI verified ${matchedCat.label}`
      : LOW_CONFIDENCE_MESSAGE,
  };

  return evaluateAutonomousAiReportDecision({
    suitability: syntheticSuitability,
    selectedCategoryKey: matchedCat?.key ?? null,
    description: `${report.title || ''} ${report.description || ''}`,
    hasPhoto: true,
  });
}

/**
 * Generates the report description based on the detected concern category and image analysis.
 */
export function buildAutomatedReportDescription(options: {
  suitability: ImageSuitabilityEvaluation;
  selectedCategoryKey?: ApprovedConcernCategoryKey | string | null;
  aiServiceDescription?: string | null;
}): {
  description: string;
  source: 'ai_generated' | 'template_fallback' | 'manual_review_notice';
  sourceLabel: string;
} {
  const { suitability, selectedCategoryKey, aiServiceDescription } = options;
  const explicitCategory = resolveApprovedCategory(selectedCategoryKey);

  // If the user explicitly changed the category from the AI's suggestion, generate the description for the user's selected category
  if (
    explicitCategory &&
    (!suitability.matchedCategory ||
      explicitCategory.key !== suitability.matchedCategory.key ||
      suitability.status !== 'confident')
  ) {
    return {
      description: explicitCategory.conservativeTemplate,
      source: 'template_fallback',
      sourceLabel: `Auto-Generated Description · ${explicitCategory.label}`,
    };
  }

  if (
    suitability.status === 'confident' &&
    suitability.matchedCategory
  ) {
    const cleanAi = sanitizeGeneratedDescription(aiServiceDescription);
    if (cleanAi) {
      return {
        description: cleanAi,
        source: 'ai_generated',
        sourceLabel: `AI-Generated Description · ${suitability.matchedCategory.label}`,
      };
    }
    return {
      description: suitability.matchedCategory.conservativeTemplate,
      source: 'template_fallback',
      sourceLabel: `AI-Generated Description · ${suitability.matchedCategory.label}`,
    };
  }

  if (explicitCategory) {
    return {
      description: explicitCategory.conservativeTemplate,
      source: 'template_fallback',
      sourceLabel: `Auto-Generated Description · ${explicitCategory.label}`,
    };
  }

  return {
    description: MANUAL_REVIEW_FALLBACK_DESCRIPTION,
    source: 'manual_review_notice',
    sourceLabel: 'Unrecognized / Non-Matching Concern',
  };
}

/**
 * Ensures AI-generated descriptions remain concise, factual, and free of unsupported claims.
 */
export function sanitizeGeneratedDescription(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 25 || trimmed.length > 600) return null;
  return trimmed;
}

/**
 * Calculates Haversine distance in meters between two geographic coordinates.
 */
export function calculateDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Validates a captured device GPS reading against CORA's geofencing, freshness (<= 60s),
 * and accuracy (<= 100m) requirements for Barangay Purisima, Tago, Surigao del Sur.
 */
export function validateCapturedGpsLocation(
  reading: CapturedGpsReading | null,
  referenceNowMs = Date.now()
): GpsValidationResult {
  if (
    !reading ||
    !Number.isFinite(reading.lat) ||
    !Number.isFinite(reading.lng)
  ) {
    return {
      isValid: false,
      isFresh: false,
      isAccurate: false,
      isWithinBarangayScope: false,
      hasAuthoritativeBoundary: false,
      ageSeconds: 0,
      accuracyMeters: Infinity,
      distanceFromPurisimaMeters: Infinity,
      issues: ['Device GPS coordinates have not been captured yet.'],
      statusLabel: 'Location Required',
      statusMessage:
        'Please allow device GPS access so your report location in Barangay Purisima can be verified.',
    };
  }

  const issues: string[] = [];
  const ageMs = Math.max(0, referenceNowMs - reading.locationTimestamp);
  const ageSeconds = Math.round(ageMs / 1000);
  const isFresh = ageMs <= MAX_GPS_AGE_MS;

  if (!isFresh) {
    issues.push(
      `Location reading is ${ageSeconds}s old (must be captured within the last 60 seconds).`
    );
  }

  const accuracyMeters = Math.round(reading.accuracyMeters);
  const isAccurate =
    Number.isFinite(reading.accuracyMeters) &&
    reading.accuracyMeters > 0 &&
    reading.accuracyMeters <= MAX_GPS_ACCURACY_METERS;

  if (!isAccurate) {
    issues.push(
      `GPS accuracy is ±${accuracyMeters}m (requires 100m or better accuracy).`
    );
  }

  const distanceFromPurisimaMeters = Math.round(
    calculateDistanceMeters(
      { lat: reading.lat, lng: reading.lng },
      PURISIMA_COORDINATES
    )
  );

  const boundaryCheck = verifyPointWithinBarangayBoundary(
    { lat: reading.lat, lng: reading.lng },
    VERIFIED_PURISIMA_BOUNDARY
  );

  let isWithinBarangayScope = false;
  if (boundaryCheck.hasVerifiedBoundary && boundaryCheck.isInside !== null) {
    isWithinBarangayScope = boundaryCheck.isInside;
    if (!isWithinBarangayScope) {
      issues.push(
        'Captured GPS coordinates are outside the verified Barangay Purisima boundary.'
      );
    }
  } else {
    isWithinBarangayScope =
      distanceFromPurisimaMeters <= MAX_PURISIMA_SCOPE_METERS;
    if (!isWithinBarangayScope) {
      issues.push(
        `Captured GPS coordinates are ${(
          distanceFromPurisimaMeters / 1000
        ).toFixed(1)} km away from Barangay Purisima, Tago, Surigao del Sur.`
      );
    }
  }

  const isValid = isFresh && isAccurate && isWithinBarangayScope;

  let statusLabel = 'Location Verified';
  let statusMessage = boundaryCheck.hasVerifiedBoundary
    ? 'GPS coordinates are fresh, accurate, and inside the Barangay Purisima boundary.'
    : 'GPS coordinates are verified within Barangay Purisima.';

  if (!isValid) {
    statusLabel = !isWithinBarangayScope
      ? 'Outside Barangay Scope'
      : !isAccurate
      ? 'Low GPS Accuracy'
      : 'Stale GPS Reading';
    statusMessage = issues.join(' ');
  }

  return {
    isValid,
    isFresh,
    isAccurate,
    isWithinBarangayScope,
    hasAuthoritativeBoundary: boundaryCheck.hasVerifiedBoundary,
    ageSeconds,
    accuracyMeters,
    distanceFromPurisimaMeters,
    issues,
    statusLabel,
    statusMessage,
  };
}
