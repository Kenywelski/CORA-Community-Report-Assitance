import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import {
  canConfirmDuplicate,
  findNearbyDuplicateReports,
  resolveDuplicateMatch,
  shouldCheckForDuplicateReports,
} from './reportDuplicates.ts';
import {
  analyzeImageBlur,
  MAX_MODEL_IMAGE_BYTES,
  MAX_REPORT_IMAGE_BYTES,
  prepareModelImage,
} from './reportImage.ts';
import {
  BLUR_VARIANCE_THRESHOLD,
  REPORT_CATEGORIES,
  calculateLaplacianVariance,
  canUseReportUpload,
  parseOpenClipDecision,
  resolveModelCategory,
  validateReportLocation,
} from './reportValidation.ts';

test('maps each MobileNet label to the supported CORA category', () => {
  assert.deepEqual(
    REPORT_CATEGORIES.map((category) => resolveModelCategory(category.modelLabel)?.key),
    ['garbage', 'street_light', 'drainage', 'road_damage'],
  );
});

test('accepts in-scope OpenCLIP results even when category labels disagree', () => {
  assert.equal(
    parseOpenClipDecision({
      decision: 'accepted',
      verification_status: 'in_scope',
      category_matches: false,
    }),
    'accepted',
  );
});

test('rejects unsupported, blurry, legacy, and malformed verification results', () => {
  assert.equal(
    parseOpenClipDecision({ decision: 'rejected', verification_status: 'out_of_scope' }),
    'rejected',
  );
  assert.equal(
    parseOpenClipDecision({ decision: 'recapture_required' }),
    'recapture_required',
  );
  assert.equal(
    parseOpenClipDecision({ decision: 'review_only', verification_status: 'in_scope' }),
    'unverified',
  );
  assert.equal(parseOpenClipDecision({ decision: 'accepted' }), 'accepted');
  assert.equal(parseOpenClipDecision({ decision: 'maybe' }), 'unverified');
});

test('geofences fresh accurate GPS readings and asks for a retry on unusable GPS', () => {
  const now = Date.now();
  assert.deepEqual(
    validateReportLocation(9.0178894, 126.2335553, 10, now, now),
    { status: 'valid' },
  );
  assert.deepEqual(
    validateReportLocation(0, 0, 10, now, now),
    { status: 'outside' },
  );
  assert.deepEqual(
    validateReportLocation(9.0178894, 126.2335553, 250, now, now),
    { status: 'retry' },
  );
  assert.deepEqual(
    validateReportLocation(9.0178894, 126.2335553, 10, now - 61_000, now),
    { status: 'retry' },
  );
});

test('limits image upload to administrator-enabled test residents', () => {
  assert.equal(canUseReportUpload(true), true);
  assert.equal(canUseReportUpload(false), false);
});

test('Laplacian variance distinguishes a sharp checkerboard from a blurred one', () => {
  const width = 32;
  const height = 32;
  const checkerboard = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      checkerboard[y * width + x] = (x + y) % 2 === 0 ? 255 : 0;
    }
  }

  const blurred = new Uint8Array(checkerboard.length).fill(128);
  assert.ok(calculateLaplacianVariance(checkerboard, width, height) > BLUR_VARIANCE_THRESHOLD);
  assert.ok(calculateLaplacianVariance(blurred, width, height) < BLUR_VARIANCE_THRESHOLD);
});

test('rejects a blurred detailed image while accepting its sharp source', async () => {
  const width = 1024;
  const height = 768;
  const pixels = Buffer.alloc(width * height);
  let state = 0x12345678;
  for (let index = 0; index < pixels.length; index += 1) {
    state = (1664525 * state + 1013904223) >>> 0;
    pixels[index] = state >>> 24;
  }
  const sharpImage = await sharp(pixels, {
    raw: { width, height, channels: 1 },
  }).png().toBuffer();
  const blurredImage = await sharp(sharpImage).blur(3).png().toBuffer();

  assert.equal((await analyzeImageBlur(sharpImage)).blurry, false);
  assert.equal((await analyzeImageBlur(blurredImage)).blurry, true);
});

test('rejects strong horizontal and vertical motion blur', async () => {
  const width = 512;
  const height = 512;
  const pixels = Buffer.alloc(width * height);
  let state = 0x12345678;
  for (let index = 0; index < pixels.length; index += 1) {
    state = (1664525 * state + 1013904223) >>> 0;
    pixels[index] = state >>> 24;
  }

  const sharpImage = await sharp(pixels, {
    raw: { width, height, channels: 1 },
  }).png().toBuffer();
  const { data: source } = await sharp(sharpImage)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const blurAlongAxis = (horizontal: boolean) => {
    const blurred = Buffer.alloc(source.length);
    const radius = 8;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let total = 0;
        let count = 0;
        for (let offset = -radius; offset <= radius; offset += 1) {
          const sampleX = horizontal ? x + offset : x;
          const sampleY = horizontal ? y : y + offset;
          if (
            sampleX >= 0 &&
            sampleX < width &&
            sampleY >= 0 &&
            sampleY < height
          ) {
            total += source[sampleY * width + sampleX];
            count += 1;
          }
        }
        blurred[y * width + x] = Math.round(total / count);
      }
    }
    return sharp(blurred, {
      raw: { width, height, channels: 1 },
    }).png().toBuffer();
  };

  for (const horizontal of [true, false]) {
    const motionBlurredImage = await blurAlongAxis(horizontal);
    const analysis = await analyzeImageBlur(motionBlurredImage);
    assert.equal(analysis.blurry, true);
    assert.ok(analysis.directionalGradientRatio < 0.15);
  }
});

test('accepts clear scenic photos and rejects blurred versions', async () => {
  const photoPaths = [
    '../frontend/features/residents/assets/purisima-sunrise.jpg',
    '../frontend/features/residents/assets/hero-coastal.jpg',
  ];

  for (const photoPath of photoPaths) {
    const photo = await readFile(new URL(photoPath, import.meta.url));
    const blurredPhoto = await sharp(photo).blur(3).png().toBuffer();
    const photoAnalysis = await analyzeImageBlur(photo);

    assert.ok(
      photoAnalysis.laplacianVariance >= BLUR_VARIANCE_THRESHOLD,
      `${photoPath} should not be rejected as blurry`,
    );
    assert.equal(
      photoAnalysis.blurry,
      false,
      `${photoPath} should be accepted as clear`,
    );
    assert.ok(
      (await analyzeImageBlur(blurredPhoto)).blurry,
      `${photoPath} should be rejected after blur is applied`,
    );
  }
});

test('prepares a large upload as a size-limited JPEG for all model requests', async () => {
  const width = 1800;
  const height = 1600;
  const pixels = Buffer.alloc(width * height * 3);
  let state = 0x12345678;
  for (let index = 0; index < pixels.length; index += 1) {
    state = (1664525 * state + 1013904223) >>> 0;
    pixels[index] = state >>> 24;
  }
  const source = await sharp(pixels, {
    raw: { width, height, channels: 3 },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();
  assert.ok(source.length > 8 * 1024 * 1024);
  assert.ok(source.length < MAX_REPORT_IMAGE_BYTES);
  assert.ok(source.length > MAX_MODEL_IMAGE_BYTES);

  const optimized = await prepareModelImage(source);
  const metadata = await sharp(optimized).metadata();

  assert.ok(optimized.length <= MAX_MODEL_IMAGE_BYTES);
  assert.equal(metadata.format, 'jpeg');
  assert.ok(metadata.width && metadata.width <= 1600);
});

test('only confirms duplicate reports with the same category and very close location', () => {
  const candidate = {
    category: 'Streetlight Problem',
    latitude: 9.0178894,
    longitude: 126.2335553,
  };
  const reports = [
    {
      id: 'same-location',
      category: 'Report: Streetlight Problem',
      latitude: 9.01799,
      longitude: 126.2335553,
    },
    {
      id: 'nearby-location',
      category: 'Streetlight Problem',
      latitude: 9.01829,
      longitude: 126.2335553,
    },
    {
      id: 'different-category',
      category: 'Report: Road Damage',
      latitude: 9.01789,
      longitude: 126.2335553,
    },
    {
      id: 'far-away',
      category: 'Report: Streetlight Problem',
      latitude: 9.02089,
      longitude: 126.2335553,
    },
  ];

  const nearby = findNearbyDuplicateReports(candidate, reports);

  assert.deepEqual(nearby.map((report) => report.id), [
    'same-location',
    'nearby-location',
  ]);
  assert.equal(canConfirmDuplicate(candidate, nearby[0]), true);
  assert.equal(canConfirmDuplicate(candidate, nearby[1]), false);
});

test('skips duplicate checks for test reports but keeps them for regular camera reports', () => {
  assert.equal(shouldCheckForDuplicateReports('upload', true), false);
  assert.equal(shouldCheckForDuplicateReports('camera', true), false);
  assert.equal(shouldCheckForDuplicateReports('camera', false), true);
});

test('only flags a duplicate when Gemini identifies a specific report at the same location', () => {
  const candidate = {
    category: 'Streetlight Problem',
    latitude: 9.0178894,
    longitude: 126.2335553,
  };
  const reports = [
    {
      id: 'nearby',
      category: 'Streetlight Problem',
      latitude: 9.01789,
      longitude: 126.2335553,
    },
    {
      id: 'far-away',
      category: 'Streetlight Problem',
      latitude: 9.01889,
      longitude: 126.2335553,
    },
  ];

  assert.deepEqual(
    resolveDuplicateMatch(candidate, reports, 'uncertain', null),
    { status: 'none', reportId: null },
  );
  assert.deepEqual(
    resolveDuplicateMatch(candidate, reports, 'uncertain', 'nearby'),
    { status: 'uncertain', reportId: null },
  );
  assert.deepEqual(
    resolveDuplicateMatch(candidate, reports, 'confirmed', 'nearby'),
    { status: 'confirmed', reportId: 'nearby' },
  );
  assert.deepEqual(
    resolveDuplicateMatch(candidate, reports, 'confirmed', 'far-away'),
    { status: 'none', reportId: null },
  );
});
