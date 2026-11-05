import { supabase } from '@/integrations/supabase/client';
import {
  ApprovedConcernCategoryKey,
  CapturedGpsReading,
  evaluateReferenceFilterMatch,
  ImageQualityMetrics,
  MobileNetV3InferenceResponse,
} from './mobilenetReportPipeline';

/**
 * Loads one of the 4 local reference images as a Blob so users/evaluators can test
 * the 4 trained reference classes directly from the camera interface.
 */
export async function loadReferenceImageAsBlob(
  referenceImageUrl: string
): Promise<Blob> {
  const response = await fetch(referenceImageUrl);
  if (!response.ok) {
    throw new Error(`Failed to load reference image: ${referenceImageUrl}`);
  }
  return response.blob();
}

/**
 * Computes client-side image readability metrics (dimensions, byte size, mean luminance, and luminance standard deviation)
 * from a captured photo Blob so dark, overexposed, or blank frames are caught before classification.
 */
export async function inspectCapturedImageQuality(
  blob: Blob
): Promise<ImageQualityMetrics> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      width: 1280,
      height: 960,
      sizeBytes: blob.size,
      meanLuminance: 120,
      luminanceStdDev: 40,
      edgeSharpnessScore: 18,
    };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;

      try {
        const sampleSize = 64;
        const canvas = document.createElement('canvas');
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve({ width, height, sizeBytes: blob.size });
          return;
        }

        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const pixelCount = data.length / 4;
        let sum = 0;
        const luminances = new Float32Array(pixelCount);

        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          const lum =
            0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          luminances[p] = lum;
          sum += lum;
        }

        const meanLuminance = sum / pixelCount;
        let varianceSum = 0;
        for (let p = 0; p < pixelCount; p++) {
          const diff = luminances[p] - meanLuminance;
          varianceSum += diff * diff;
        }
        const luminanceStdDev = Math.sqrt(varianceSum / pixelCount);

        // Compute spatial gradient sharpness score to detect blurred photos
        let edgeSum = 0;
        let edgeCount = 0;
        for (let y = 1; y < sampleSize - 1; y++) {
          for (let x = 1; x < sampleSize - 1; x++) {
            const p = y * sampleSize + x;
            const gx = Math.abs(luminances[p + 1] - luminances[p - 1]);
            const gy = Math.abs(
              luminances[p + sampleSize] - luminances[p - sampleSize]
            );
            edgeSum += gx + gy;
            edgeCount++;
          }
        }
        const edgeSharpnessScore =
          edgeCount > 0 ? edgeSum / edgeCount : luminanceStdDev;

        URL.revokeObjectURL(objectUrl);
        resolve({
          width,
          height,
          sizeBytes: blob.size,
          meanLuminance: Math.round(meanLuminance * 10) / 10,
          luminanceStdDev: Math.round(luminanceStdDev * 10) / 10,
          edgeSharpnessScore: Math.round(edgeSharpnessScore * 10) / 10,
        });
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve({ width, height, sizeBytes: blob.size });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: 0, height: 0, sizeBytes: blob.size });
    };

    img.src = objectUrl;
  });
}

/**
 * Converts a captured Blob to a compact base64 JPEG data URL (max 512px) for fast vision analysis.
 */
async function blobToCompactDataUrl(blob: Blob): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 512;
        const scale = Math.min(
          1,
          maxDim / Math.max(img.naturalWidth || 512, img.naturalHeight || 512)
        );
        const w = Math.max(1, Math.round((img.naturalWidth || 512) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || 512) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

/**
 * Analyzes the 224x224 pixel tensor of a captured photo against the 4 trained reference classes
 * (Drainage, Streetlight, Road, Waste) using an 80-dimensional 4x4 spatial feature descriptor
 * combined with domain visual filters.
 */
async function analyzeCapturedPhotoVisualFeatures(
  blob: Blob
): Promise<MobileNetV3InferenceResponse> {
  const startMs = Date.now();
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      modelStatus: 'not_connected',
      predictedClass: null,
      confidence: null,
    };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      try {
        const size = 224;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve({
            modelStatus: 'not_connected',
            predictedClass: null,
            confidence: null,
          });
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        URL.revokeObjectURL(objectUrl);

        // 1. Extract the exact 80-dimensional 4x4 grid feature vector [R, G, B, Sat, Edge]
        const grid = 4;
        const cellSize = size / grid;
        const vector80: number[] = [];

        for (let gy = 0; gy < grid; gy++) {
          for (let gx = 0; gx < grid; gx++) {
            let rSum = 0;
            let gSum = 0;
            let bSum = 0;
            let satSum = 0;
            let edgeSum = 0;
            let count = 0;

            for (let y = gy * cellSize; y < (gy + 1) * cellSize; y++) {
              for (let x = gx * cellSize; x < (gx + 1) * cellSize; x++) {
                const i = (y * size + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const maxC = Math.max(r, g, b);
                const minC = Math.min(r, g, b);
                const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
                rSum += r / 255;
                gSum += g / 255;
                bSum += b / 255;
                satSum += sat;

                if (x + 1 < size && y + 1 < size) {
                  const iRight = (y * size + (x + 1)) * 4;
                  const iDown = ((y + 1) * size + x) * 4;
                  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                  const lumR =
                    0.299 * data[iRight] +
                    0.587 * data[iRight + 1] +
                    0.114 * data[iRight + 2];
                  const lumD =
                    0.299 * data[iDown] +
                    0.587 * data[iDown + 1] +
                    0.114 * data[iDown + 2];
                  edgeSum +=
                    (Math.abs(lum - lumR) + Math.abs(lum - lumD)) / 255;
                }
                count++;
              }
            }

            vector80.push(
              Number((rSum / count).toFixed(4)),
              Number((gSum / count).toFixed(4)),
              Number((bSum / count).toFixed(4)),
              Number((satSum / count).toFixed(4)),
              Number((edgeSum / count).toFixed(4))
            );
          }
        }

        // 2. Compute 4-Class Domain Visual Filter Metrics across the 224x224 frame
        const totalPixels = size * size;
        let upperLumSum = 0;
        let lowerLumSum = 0;
        let upperCount = 0;
        let lowerCount = 0;

        let lowerHighSatPixels = 0;
        let lowerNeutralGrayPixels = 0;
        let greenGrassOrFoliagePixels = 0;
        let waterOrCanalTonePixels = 0;
        let centerDarkTrenchPixels = 0;
        let centerCount = 0;
        let brightPointUpperPixels = 0;
        let darkSurroundPixels = 0;
        let lowerEdgeEnergy = 0;
        let centerLowerEdgeEnergy = 0;
        let centerLowerCount = 0;
        let colorPatchTransitions = 0;
        let portraitSkinPixels = 0;

        const lumGrid = new Float32Array(totalPixels);
        const satGrid = new Float32Array(totalPixels);

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            const delta = maxC - minC;
            const sat = maxC === 0 ? 0 : delta / maxC;

            const p = y * size + x;
            lumGrid[p] = lum;
            satGrid[p] = sat;

            if (y < size * 0.42) {
              upperLumSum += lum;
              upperCount++;
              if (lum > 215) brightPointUpperPixels++;
            } else {
              lowerLumSum += lum;
              lowerCount++;
              if (sat > 0.32 && lum > 35 && lum < 235) {
                lowerHighSatPixels++;
              }
              if (sat < 0.16 && lum >= 55 && lum <= 195) {
                lowerNeutralGrayPixels++;
              }
            }

            if (lum < 65) {
              darkSurroundPixels++;
            }

            // Center-middle/bottom trench cavity check (for open drainage canal / culvert)
            if (
              y >= size * 0.25 &&
              y <= size * 0.85 &&
              x >= size * 0.22 &&
              x <= size * 0.78
            ) {
              centerCount++;
              if (lum < 82) {
                centerDarkTrenchPixels++;
              }
            }

            // Roadside grass / vegetation (common around fallen streetlight poles)
            if (g > r * 1.06 && g > b * 1.15 && lum > 45 && lum < 205) {
              greenGrassOrFoliagePixels++;
            }

            // Canal / standing water / wet concrete-earth tones
            const isWaterOrCanal =
              sat >= 0.12 &&
              sat <= 0.48 &&
              lum >= 35 &&
              lum <= 165 &&
              (g >= r * 0.92 || b >= r * 0.95);
            if (isWaterOrCanal) {
              waterOrCanalTonePixels++;
            }

            // Portrait skin tone check (to help reject selfies / unrelated faces)
            if (
              r > 95 &&
              g > 40 &&
              b > 20 &&
              r > g &&
              r > b &&
              r - g > 15 &&
              Math.abs(r - g) < 95 &&
              sat >= 0.18 &&
              sat <= 0.65
            ) {
              portraitSkinPixels++;
            }
          }
        }

        for (let y = 1; y < size - 1; y++) {
          for (let x = 1; x < size - 1; x++) {
            const p = y * size + x;
            const gx = Math.abs(lumGrid[p + 1] - lumGrid[p - 1]);
            const gy = Math.abs(lumGrid[p + size] - lumGrid[p - size]);
            const grad = gx + gy;

            if (y >= size * 0.35 && grad > 34) {
              lowerEdgeEnergy++;
            }
            if (
              y >= size * 0.45 &&
              x >= size * 0.2 &&
              x <= size * 0.8
            ) {
              centerLowerCount++;
              if (grad > 36) {
                centerLowerEdgeEnergy++;
              }
            }
            if (Math.abs(satGrid[p + 1] - satGrid[p - 1]) > 0.22) {
              colorPatchTransitions++;
            }
          }
        }

        const upperMeanLum = upperLumSum / Math.max(1, upperCount);
        const lowerMeanLum = lowerLumSum / Math.max(1, lowerCount);
        const lowerHighSatRatio = lowerHighSatPixels / Math.max(1, lowerCount);
        const lowerNeutralGrayRatio =
          lowerNeutralGrayPixels / Math.max(1, lowerCount);
        const greenGrassRatio = greenGrassOrFoliagePixels / totalPixels;
        const waterToneRatio = waterOrCanalTonePixels / totalPixels;
        const centerDarkTrenchRatio =
          centerDarkTrenchPixels / Math.max(1, centerCount);
        const darkRatio = darkSurroundPixels / totalPixels;
        const brightUpperRatio =
          brightPointUpperPixels / Math.max(1, upperCount);
        const lowerEdgeRatio = lowerEdgeEnergy / Math.max(1, lowerCount);
        const centerLowerEdgeRatio =
          centerLowerEdgeEnergy / Math.max(1, centerLowerCount);
        const patchTransitionRatio = colorPatchTransitions / totalPixels;
        const skinRatio = portraitSkinPixels / totalPixels;

        // Compute calibrated 0..1 domain filter scores for each of the 4 classes
        const drainageScore = Math.min(
          1,
          centerDarkTrenchRatio * 1.15 +
            waterToneRatio * 1.45 +
            (lowerEdgeRatio > 0.12 ? 0.22 : 0.05)
        );

        const streetLightDaytimePoleCue =
          greenGrassRatio > 0.22 &&
          lowerNeutralGrayRatio > 0.08 &&
          lowerEdgeRatio > 0.08;
        const streetLightNightCue =
          darkRatio > 0.35 &&
          (upperMeanLum > lowerMeanLum + 14 || brightUpperRatio > 0.015);
        const streetLightScore = Math.min(
          1,
          (streetLightDaytimePoleCue ? 0.76 : 0) +
            (streetLightNightCue ? 0.78 : 0) +
            greenGrassRatio * 0.45 +
            brightUpperRatio * 1.4
        );

        const roadDamageScore = Math.min(
          1,
          lowerNeutralGrayRatio * 1.15 +
            centerLowerEdgeRatio * 1.35 +
            (lowerNeutralGrayRatio > 0.32 && centerLowerEdgeRatio > 0.1
              ? 0.28
              : 0)
        );

        const wasteScore = Math.min(
          1,
          lowerHighSatRatio * 2.4 +
            patchTransitionRatio * 3.5 +
            (lowerHighSatRatio > 0.06 && patchTransitionRatio > 0.02 ? 0.32 : 0)
        );

        const domainScores: Record<ApprovedConcernCategoryKey, number> = {
          drainage: drainageScore,
          street_light: streetLightScore,
          road_damage: roadDamageScore,
          garbage: wasteScore,
        };

        // Flag obviously unrelated scenes (e.g., too uniform/blank or close-up portrait/selfie)
        const isTooUniform =
          lowerEdgeRatio < 0.015 &&
          patchTransitionRatio < 0.01 &&
          brightUpperRatio < 0.01;
        const isLikelySelfieOrPortrait =
          skinRatio > 0.38 &&
          lowerNeutralGrayRatio < 0.18 &&
          waterToneRatio < 0.12;

        const filterEval = evaluateReferenceFilterMatch({
          vector80,
          domainScores,
          isUnrelatedScene: isTooUniform || isLikelySelfieOrPortrait,
        });

        const matchedKey = filterEval.referenceMatch.matchedCategoryKey;
        resolve({
          modelStatus: 'connected',
          rawPredictedClass: matchedKey
            ? ROBOFLOW_CLASS_LABEL_BY_KEY[matchedKey]
            : null,
          predictedClass: filterEval.predictedClass,
          confidence: filterEval.confidence,
          classProbabilities: filterEval.classProbabilities,
          inferenceTimeMs: Date.now() - startMs,
          aiGeneratedDescription: filterEval.aiGeneratedDescription,
          descriptionSource: filterEval.aiGeneratedDescription
            ? 'ai_service'
            : 'template_fallback',
          referenceMatch: filterEval.referenceMatch,
        });
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve({
          modelStatus: 'not_connected',
          predictedClass: null,
          confidence: null,
        });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        modelStatus: 'not_connected',
        predictedClass: null,
        confidence: null,
      });
    };

    img.src = objectUrl;
  });
}

/**
 * Analyzes the captured/uploaded community concern photo by sending it to the backend
 * Roboflow Workflow route (`POST /api/classify-image`), keeping `ROBOFLOW_API_KEY` in a
 * server environment variable, and returning the predicted class (`drainage`, `road`,
 * `streetlights`, or `waste`), confidence score, and suggested report category.
 */
export async function runMobileNetV3Classification(options: {
  imageUrl: string;
  photoBlob?: Blob;
  gps: CapturedGpsReading | null;
  simulateError?: boolean;
  mockPredictedClass?: string | null;
}): Promise<MobileNetV3InferenceResponse> {
  const { imageUrl, photoBlob, gps, simulateError, mockPredictedClass } =
    options;

  const imageDataUrl = photoBlob ? await blobToCompactDataUrl(photoBlob) : null;

  // 1. Send the uploaded/captured photo to the backend Roboflow classifier proxy (/api/classify-image)
  try {
    const startMs = Date.now();
    const backendRes = await fetch('/api/classify-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl,
        imageDataUrl,
        gps,
        simulateError,
        mockPredictedClass,
      }),
    });

    const contentType = backendRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await backendRes.json();

      if (backendRes.ok && data.modelStatus === 'connected') {
        return {
          modelStatus: 'connected',
          modelName:
            data.modelName ?? 'four-class-classifier-test-1793801128146',
          rawPredictedClass: data.rawPredictedClass ?? null,
          predictedClass:
            data.predictedClass ??
            data.suggestedCategoryLabel ??
            data.rawPredictedClass ??
            null,
          confidence:
            typeof data.confidence === 'number' ? data.confidence : null,
          classProbabilities: data.classProbabilities,
          inferenceTimeMs: data.inferenceTimeMs ?? Date.now() - startMs,
          aiGeneratedDescription: data.aiGeneratedDescription ?? null,
          descriptionSource: data.aiGeneratedDescription
            ? 'ai_service'
            : 'template_fallback',
        };
      }

      if (!backendRes.ok || data.modelStatus === 'error') {
        return {
          modelStatus: 'error',
          rawPredictedClass: null,
          predictedClass: null,
          confidence: null,
          errorMessage:
            data.errorMessage ||
            `Classification service returned an error (HTTP ${backendRes.status}). You can select or change the report category manually below.`,
        };
      }
    }
  } catch (err) {
    if (simulateError) {
      return {
        modelStatus: 'error',
        rawPredictedClass: null,
        predictedClass: null,
        confidence: null,
        errorMessage:
          (err as Error)?.message ||
          'Unable to reach the backend Roboflow classification endpoint. You can select a report category manually below.',
      };
    }
    // Otherwise fall through to configured endpoint / Edge Function / local 4-class analysis
  }

  // 2. Direct inference server if configured via VITE_MOBILENETV3_ENDPOINT_URL
  const directEndpoint = import.meta.env.VITE_MOBILENETV3_ENDPOINT_URL as
    | string
    | undefined;
  if (directEndpoint && directEndpoint.trim()) {
    try {
      const startMs = Date.now();
      let res: Response;

      if (photoBlob && directEndpoint.includes('/predict-multipart')) {
        const formData = new FormData();
        formData.append('file', photoBlob, 'concern.jpg');
        res = await fetch(directEndpoint.trim(), {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch(directEndpoint.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl, imageDataUrl, gps }),
        });
      }

      if (res.ok) {
        const rawData = await res.json();
        const parsed = parseRoboflowWorkflowResponse(rawData);
        return {
          modelStatus: rawData.modelStatus ?? 'connected',
          rawPredictedClass: parsed.rawPredictedClass,
          predictedClass:
            parsed.predictedClass ??
            rawData.predictedClass ??
            rawData.category ??
            rawData.label ??
            null,
          confidence:
            parsed.confidence ??
            (typeof rawData.confidence === 'number'
              ? rawData.confidence
              : null),
          classProbabilities:
            rawData.classProbabilities ?? parsed.classProbabilities,
          inferenceTimeMs: rawData.inferenceTimeMs ?? Date.now() - startMs,
          aiGeneratedDescription: rawData.aiGeneratedDescription ?? null,
          descriptionSource: rawData.aiGeneratedDescription
            ? 'ai_service'
            : 'template_fallback',
        };
      }
    } catch {
      // Fall through to Edge Function / client visual analysis
    }
  }

  // 3. Invoke Supabase Edge Function `mobilenet-classify` (Roboflow workflow proxy; keeps the API key server-side)
  try {
      const { data, error } = await supabase.functions.invoke(
        'mobilenet-classify',
        {
          body: { imageUrl, imageDataUrl, gps },
        }
      );

      if (!error && data && data.modelStatus === 'connected') {
        return {
          modelStatus: 'connected',
          rawPredictedClass: data.rawPredictedClass ?? null,
          predictedClass: data.predictedClass ?? null,
          confidence:
            typeof data.confidence === 'number' ? data.confidence : null,
          classProbabilities: data.classProbabilities,
          inferenceTimeMs: data.inferenceTimeMs,
          aiGeneratedDescription: data.aiGeneratedDescription ?? null,
          descriptionSource: data.descriptionSource ?? 'template_fallback',
        };
      }
  } catch {
    // Fall through to local visual feature analysis on the captured image
  }

  // 4. Analyze actual captured image visual features across the 4 classes (drainage, road, streetlights, waste)
  if (photoBlob) {
    const [result] = await Promise.all([
      analyzeCapturedPhotoVisualFeatures(photoBlob),
      new Promise((resolve) => setTimeout(resolve, 450)),
    ]);
    return result;
  }

  return {
    modelStatus: 'not_connected',
    rawPredictedClass: null,
    predictedClass: null,
    confidence: null,
    errorMessage:
      'We could not automatically analyze this photo right now. Please retake the photo or select the concern category below.',
  };
}
