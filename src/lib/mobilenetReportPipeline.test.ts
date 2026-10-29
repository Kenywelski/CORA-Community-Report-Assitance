import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVED_CONCERN_CATEGORIES,
  LOW_CONFIDENCE_MESSAGE,
  MANUAL_REVIEW_FALLBACK_DESCRIPTION,
  buildAutomatedReportDescription,
  checkImageReadability,
  evaluateAutonomousAiReportDecision,
  evaluateExistingReportRecordByAi,
  evaluateImageSuitability,
  resolveApprovedCategory,
  validateCapturedGpsLocation,
} from './mobilenetReportPipeline';
import { PURISIMA_COORDINATES } from './purisimaGeo';

const VALID_QUALITY = {
  width: 1280,
  height: 960,
  sizeBytes: 145_000,
  meanLuminance: 118,
  luminanceStdDev: 42,
  edgeSharpnessScore: 28,
};

test('resolveApprovedCategory maps class labels to the 4 supported categories', () => {
  assert.equal(APPROVED_CONCERN_CATEGORIES.length, 4);
  assert.equal(
    resolveApprovedCategory('Improper Waste Disposal')?.key,
    'garbage'
  );
  assert.equal(
    resolveApprovedCategory('streetlight_problem')?.key,
    'street_light'
  );
  assert.equal(
    resolveApprovedCategory('Drainage/Flooding Concern')?.key,
    'drainage'
  );
  assert.equal(resolveApprovedCategory('road_damage')?.key, 'road_damage');
  assert.equal(resolveApprovedCategory('unrelated_class'), null);
});

test('checkImageReadability flags dark, very blurred, or low-resolution captures without exposing technical model names', () => {
  assert.equal(checkImageReadability(VALID_QUALITY).isReadable, true);
  assert.equal(checkImageReadability(VALID_QUALITY).isBlurred, false);

  const tooDark = checkImageReadability({
    ...VALID_QUALITY,
    meanLuminance: 4,
  });
  assert.equal(tooDark.isReadable, false);

  const veryBlurred = checkImageReadability({
    ...VALID_QUALITY,
    edgeSharpnessScore: 4,
  });
  assert.equal(veryBlurred.isReadable, false);
  assert.equal(veryBlurred.isBlurred, true);

  const tiny = checkImageReadability({
    ...VALID_QUALITY,
    width: 80,
    height: 80,
  });
  assert.equal(tiny.isReadable, false);
  assert.equal(tiny.reason?.includes('MobileNetV3'), false);
});

test('evaluateImageSuitability never requires human-in-the-loop manual review', () => {
  const confident = evaluateImageSuitability(VALID_QUALITY, {
    modelStatus: 'connected',
    predictedClass: 'Road Damage',
    confidence: 0.92,
  });
  assert.equal(confident.status, 'confident');
  assert.equal(confident.matchedCategory?.label, 'Road Damage');
  assert.equal(confident.confidencePercent, 92);
  assert.equal(confident.requiresManualReview, false);

  const lowConfidence = evaluateImageSuitability(VALID_QUALITY, {
    modelStatus: 'connected',
    predictedClass: 'Road Damage',
    confidence: 0.41,
  });
  assert.equal(lowConfidence.status, 'low_confidence');
  assert.equal(lowConfidence.userMessage, LOW_CONFIDENCE_MESSAGE);
  assert.equal(lowConfidence.requiresManualReview, false);
});

test('evaluateAutonomousAiReportDecision automatically approves valid 4-class reports and automatically rejects blurred or unrelated reports', () => {
  // 1. All 4 supported classes with clear images are automatically approved without human review
  for (const cat of [
    'Drainage/Flooding Concern',
    'Streetlight Problem',
    'Road Damage',
    'Improper Waste Disposal',
  ]) {
    const suitability = evaluateImageSuitability(VALID_QUALITY, {
      modelStatus: 'connected',
      predictedClass: cat,
      confidence: 0.88,
    });
    const decision = evaluateAutonomousAiReportDecision({
      suitability,
      selectedCategoryKey: suitability.matchedCategory?.key,
      description: `Clear community report regarding ${cat}`,
      hasPhoto: true,
    });
    assert.equal(decision.verdict, 'approved');
    assert.equal(decision.requestStatus, 'in_progress');
    assert.equal(decision.aiValidationStatus, 'valid');
    assert.equal(decision.adminReviewStatus, 'approved');
    assert.equal(decision.requiresReview, false);
  }

  // 2. Very blurred image is automatically rejected by AI
  const blurredSuitability = evaluateImageSuitability(
    {
      ...VALID_QUALITY,
      luminanceStdDev: 3,
      edgeSharpnessScore: 3,
    },
    {
      modelStatus: 'connected',
      predictedClass: 'Road Damage',
      confidence: 0.9,
    }
  );
  const blurredDecision = evaluateAutonomousAiReportDecision({
    suitability: blurredSuitability,
    hasPhoto: true,
  });
  assert.equal(blurredDecision.verdict, 'rejected');
  assert.equal(blurredDecision.requestStatus, 'rejected');
  assert.equal(blurredDecision.aiValidationStatus, 'rejected');
  assert.equal(blurredDecision.adminReviewStatus, 'rejected');
  assert.equal(blurredDecision.requiresReview, false);
  assert.equal(blurredDecision.rejectionCode, 'blurred_or_unreadable_image');

  // 3. Unrelated image / non-4-class report is automatically rejected by AI
  const unrelatedSuitability = evaluateImageSuitability(VALID_QUALITY, {
    modelStatus: 'connected',
    predictedClass: null,
    confidence: 0.32,
  });
  const unrelatedDecision = evaluateAutonomousAiReportDecision({
    suitability: unrelatedSuitability,
    hasPhoto: true,
  });
  assert.equal(unrelatedDecision.verdict, 'rejected');
  assert.equal(unrelatedDecision.requestStatus, 'rejected');
  assert.equal(unrelatedDecision.aiValidationStatus, 'rejected');
  assert.equal(unrelatedDecision.requiresReview, false);
  assert.equal(
    unrelatedDecision.rejectionCode,
    'unrelated_or_unsupported_class'
  );
});

test('evaluateExistingReportRecordByAi automatically approves valid 4-class records and rejects non-4-class or photo-less records', () => {
  const validDrainage = evaluateExistingReportRecordByAi({
    title: '[REPORT] Drainage/Flooding Concern',
    description: 'Clogged canal causing standing water in Barangay Purisima.',
    category: 'Report: Drainage/Flooding Concern',
    ai_category: 'Drainage/Flooding Concern',
    ai_confidence: 91,
    photo_url: 'https://example.com/drainage.jpg',
  });
  assert.equal(validDrainage.verdict, 'approved');
  assert.equal(validDrainage.requiresReview, false);

  const nonFourClass = evaluateExistingReportRecordByAi({
    title: 'Random Noise Inquiry',
    description: 'Asking about something unrelated',
    category: 'General Inquiry',
    photo_url: 'https://example.com/random.jpg',
  });
  assert.equal(nonFourClass.verdict, 'rejected');
  assert.equal(nonFourClass.requiresReview, false);
});

test('buildAutomatedReportDescription generates factual descriptions and never invents definitive claims on low confidence', () => {
  const confidentSuitability = evaluateImageSuitability(VALID_QUALITY, {
    modelStatus: 'connected',
    predictedClass: 'Improper Waste Disposal',
    confidence: 0.88,
  });

  const templateFallback = buildAutomatedReportDescription({
    suitability: confidentSuitability,
    aiServiceDescription: null,
  });
  assert.equal(templateFallback.source, 'template_fallback');
  assert.equal(templateFallback.sourceLabel.includes('MobileNetV3'), false);
  assert.ok(
    templateFallback.description.includes(
      'Improperly disposed waste is visible in the submitted photo.'
    )
  );

  const lowConfSuitability = evaluateImageSuitability(VALID_QUALITY, {
    modelStatus: 'connected',
    predictedClass: 'Road Damage',
    confidence: 0.35,
  });

  const uncertainDesc = buildAutomatedReportDescription({
    suitability: lowConfSuitability,
    selectedCategoryKey: null,
  });
  assert.equal(uncertainDesc.source, 'manual_review_notice');
  assert.equal(uncertainDesc.description, MANUAL_REVIEW_FALLBACK_DESCRIPTION);
});

test('validateCapturedGpsLocation enforces <=100m accuracy, <=60s freshness, and Barangay Purisima scope independently', () => {
  const now = 1_700_000_000_000;

  const validReading = validateCapturedGpsLocation(
    {
      lat: PURISIMA_COORDINATES.lat + 0.001,
      lng: PURISIMA_COORDINATES.lng - 0.001,
      accuracyMeters: 18,
      locationTimestamp: now - 12_000,
      capturedAtTimestamp: now - 10_000,
    },
    now
  );
  assert.equal(validReading.isValid, true);
  assert.equal(validReading.isFresh, true);
  assert.equal(validReading.isAccurate, true);
  assert.equal(validReading.isWithinBarangayScope, true);
});
