import sharp from 'sharp';
import {
  BLUR_VARIANCE_THRESHOLD,
  calculateDirectionalGradientEnergy,
  calculateLaplacianVariance,
  MOTION_BLUR_DIRECTIONAL_RATIO_THRESHOLD,
  MOTION_BLUR_MIN_DIRECTIONAL_ENERGY,
} from './reportValidation.ts';

export const MAX_REPORT_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_MODEL_IMAGE_BYTES = 900 * 1024;

const MODEL_IMAGE_WIDTHS = [1600, 1280, 1024, 800, 640] as const;
const BLUR_ANALYSIS_WIDTH = 512;

export interface ImageBlurAnalysis {
  laplacianVariance: number;
  directionalGradientRatio: number;
  blurry: boolean;
}

export async function analyzeImageBlur(buffer: Buffer): Promise<ImageBlurAnalysis> {
  const { data, info } = await sharp(buffer)
    .rotate()
    .greyscale()
    .resize({
      width: BLUR_ANALYSIS_WIDTH,
      height: BLUR_ANALYSIS_WIDTH,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const laplacianVariance = calculateLaplacianVariance(
    data,
    info.width,
    info.height,
  );
  const directionalEnergy = calculateDirectionalGradientEnergy(
    data,
    info.width,
    info.height,
  );
  const strongestDirection = Math.max(
    directionalEnergy.horizontal,
    directionalEnergy.vertical,
  );
  const directionalGradientRatio =
    strongestDirection === 0
      ? 1
      : Math.min(
          directionalEnergy.horizontal,
          directionalEnergy.vertical,
        ) / strongestDirection;

  return {
    laplacianVariance,
    directionalGradientRatio,
    blurry:
      laplacianVariance < BLUR_VARIANCE_THRESHOLD ||
      (strongestDirection >= MOTION_BLUR_MIN_DIRECTIONAL_ENERGY &&
        directionalGradientRatio < MOTION_BLUR_DIRECTIONAL_RATIO_THRESHOLD),
  };
}

export async function prepareModelImage(buffer: Buffer): Promise<Buffer> {
  for (const width of MODEL_IMAGE_WIDTHS) {
    const image = await sharp(buffer)
      .rotate()
      .resize({
        width,
        height: width,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();

    if (image.length <= MAX_MODEL_IMAGE_BYTES) return image;
  }

  throw new Error('Image exceeds the model upload size limit after optimization.');
}
