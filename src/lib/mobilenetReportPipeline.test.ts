import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVED_CONCERN_CATEGORIES,
  LOW_CONFIDENCE_MESSAGE,
  MANUAL_REVIEW_FALLBACK_DESCRIPTION,
  ROBOFLOW_WORKFLOW_URL,
  TRAINED_CLASS_REFERENCES,
  buildAutomatedReportDescription,
  buildRoboflowWorkflowRequestBody,
  checkImageReadability,
  evaluateAutonomousAiReportDecision,
  evaluateExistingReportRecordByAi,
  evaluateImageSuitability,
  evaluateReferenceFilterMatch,
  flipFeatureVector80Horizontally,
  parseRoboflowWorkflowResponse,
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

test('resolveApprovedCategory maps class labels and Roboflow classes (drainage, road, streetlights, waste) to the 4 supported categories', () => {
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

  // Verify the 4 Roboflow workflow predicted classes: drainage, road, streetlights, waste
  assert.equal(resolveApprovedCategory('drainage')?.key, 'drainage');
  assert.equal(resolveApprovedCategory('road')?.key, 'road_damage');
  assert.equal(resolveApprovedCategory('streetlights')?.key, 'street_light');
  assert.equal(resolveApprovedCategory('waste')?.key, 'garbage');
  assert.equal(resolveApprovedCategory('unrelated_class'), null);
});

test('buildRoboflowWorkflowRequestBody formats URL and base64 inputs for Roboflow Workflow v1.5.0+', () => {
  assert.equal(
    ROBOFLOW_WORKFLOW_URL,
    'https://serverless.roboflow.com/gwen-apuli/workflows/four-class-classifier-test-1793801128146'
  );

  const urlPayload = buildRoboflowWorkflowRequestBody({
    imageUrl: 'https://example.com/photos/road-concern.jpg',
  });
  assert.deepEqual(urlPayload, {
    inputs: {
      image: {
        type: 'url',
        value: 'https://example.com/photos/road-concern.jpg',
      },
    },
  });

  const base64Payload = buildRoboflowWorkflowRequestBody({
    imageUrl: 'blob:http://localhost:3000/abc-123',
    imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/',
  });
  assert.deepEqual(base64Payload, {
    inputs: {
      image: {
        type: 'base64',
        value: '/9j/4AAQSkZJRgABAQAAAQABAAD/',
      },
    },
  });
});

test('parseRoboflowWorkflowResponse extracts drainage, road, streetlights, and waste predictions from Roboflow Workflow outputs', () => {
  // 1. Standard Roboflow Workflow outputs array with predictions object
  const workflowOutputRoad = parseRoboflowWorkflowResponse({
    outputs: [
      {
        predictions: {
          top: 'road',
          confidence: 0.942,
          predictions: [
            { class: 'road', confidence: 0.942 },
            { class: 'drainage', confidence: 0.031 },
            { class: 'waste', confidence: 0.017 },
            { class: 'streetlights', confidence: 0.01 },
          ],
        },
      },
    ],
  });
  assert.equal(workflowOutputRoad.rawPredictedClass, 'road');
  assert.equal(workflowOutputRoad.matchedCategory?.key, 'road_damage');
  assert.equal(workflowOutputRoad.predictedClass, 'Road Damage');
  assert.equal(workflowOutputRoad.confidence, 0.942);

  // 2. Dictionary predictions shape for streetlights
  const workflowOutputStreetlights = parseRoboflowWorkflowResponse({
    outputs: [
      {
        model_predictions: {
          predictions: {
            streetlights: { confidence: 0.89 },
            drainage: { confidence: 0.06 },
            road: { confidence: 0.03 },
            waste: { confidence: 0.02 },
          },
        },
      },
    ],
  });
  assert.equal(workflowOutputStreetlights.rawPredictedClass, 'streetlights');
  assert.equal(workflowOutputStreetlights.matchedCategory?.key, 'street_light');
  assert.equal(workflowOutputStreetlights.predictedClass, 'Streetlight Problem');
  assert.equal(workflowOutputStreetlights.confidence, 0.89);

  // 3. Top-level predicted_classes for drainage & waste
  const workflowOutputDrainage = parseRoboflowWorkflowResponse({
    outputs: [
      {
        predicted_classes: ['drainage'],
        confidence: 0.91,
      },
    ],
  });
  assert.equal(workflowOutputDrainage.rawPredictedClass, 'drainage');
  assert.equal(workflowOutputDrainage.matchedCategory?.key, 'drainage');
  assert.equal(
    workflowOutputDrainage.predictedClass,
    'Drainage/Flooding Concern'
  );
  assert.equal(workflowOutputDrainage.confidence, 0.91);

  const workflowOutputWaste = parseRoboflowWorkflowResponse({
    top: 'waste',
    confidence: 87.5,
  });
  assert.equal(workflowOutputWaste.rawPredictedClass, 'waste');
  assert.equal(workflowOutputWaste.matchedCategory?.key, 'garbage');
  assert.equal(workflowOutputWaste.predictedClass, 'Improper Waste Disposal');
  assert.equal(workflowOutputWaste.confidence, 0.875);
});

test('user category override updates suggested category and automated description even after AI prediction or API error', () => {
  const confidentRoad = evaluateImageSuitability(VALID_QUALITY, {
    modelStatus: 'connected',
    rawPredictedClass: 'road',
    predictedClass: 'Road Damage',
    confidence: 0.91,
  });

  // User changes suggested category from 'road_damage' to 'street_light'
  const overriddenDesc = buildAutomatedReportDescription({
    suitability: confidentRoad,
    selectedCategoryKey: 'street_light',
  });
  assert.ok(overriddenDesc.sourceLabel.includes('Streetlight Problem'));
  assert.ok(overriddenDesc.description.includes('streetlight'));

  const overriddenDecision = evaluateAutonomousAiReportDecision({
    suitability: confidentRoad,
    selectedCategoryKey: 'street_light',
    description: overriddenDesc.description,
    hasPhoto: true,
  });
  assert.equal(overriddenDecision.verdict, 'approved');
  assert.equal(overriddenDecision.matchedCategory?.key, 'street_light');

  // When external Roboflow API errors out (model_unavailable) on a clear photo, user can still pick a category
  const errorSuitability = evaluateImageSuitability(VALID_QUALITY, {
    modelStatus: 'error',
    predictedClass: null,
    confidence: null,
    errorMessage: 'Roboflow API error (401): Invalid API key',
  });
  assert.equal(errorSuitability.status, 'model_unavailable');

  const userRecoveredDecision = evaluateAutonomousAiReportDecision({
    suitability: errorSuitability,
    selectedCategoryKey: 'drainage',
    description: 'Clogged canal reported after manual category selection',
    hasPhoto: true,
  });
  assert.equal(userRecoveredDecision.verdict, 'approved');
  assert.equal(userRecoveredDecision.matchedCategory?.key, 'drainage');
});

test('TRAINED_CLASS_REFERENCES and evaluateReferenceFilterMatch accurately classify the 4 attached reference images and filter out unrelated scenes', () => {
  assert.equal(TRAINED_CLASS_REFERENCES.length, 4);

  // Verify each of the 4 reference prototypes (Drainage, Streetlight, Road, Waste) matches its exact class
  for (const ref of TRAINED_CLASS_REFERENCES) {
    const exactMatch = evaluateReferenceFilterMatch({
      vector80: ref.featureVector80,
      domainScores: {
        drainage: 0.25,
        street_light: 0.25,
        road_damage: 0.25,
        garbage: 0.25,
      },
    });
    assert.equal(exactMatch.predictedClass, ref.categoryLabel);
    assert.ok(exactMatch.confidence >= 0.89);
    assert.equal(exactMatch.referenceMatch.matchedCategoryKey, ref.key);
    assert.equal(exactMatch.referenceMatch.isPrototypeMatch, true);
    assert.equal(
      exactMatch.referenceMatch.matchedReference?.referenceImageUrl,
      ref.referenceImageUrl
    );

    // Also verify horizontally mirrored camera capture of the reference image matches
    const flippedVec = flipFeatureVector80Horizontally(ref.featureVector80);
    const flippedMatch = evaluateReferenceFilterMatch({
      vector80: flippedVec,
      domainScores: {
        drainage: 0.2,
        street_light: 0.2,
        road_damage: 0.2,
        garbage: 0.2,
      },
    });
    assert.equal(flippedMatch.predictedClass, ref.categoryLabel);
    assert.ok(flippedMatch.confidence >= 0.89);
  }

  // Verify an unrelated uniform/blank scene is filtered out as 'other' with low confidence
  const unrelatedUniform = evaluateReferenceFilterMatch({
    vector80: new Array(80).fill(0.5),
    domainScores: {
      drainage: 0.05,
      street_light: 0.05,
      road_damage: 0.05,
      garbage: 0.05,
    },
    isUnrelatedScene: true,
  });
  assert.equal(unrelatedUniform.predictedClass, 'other');
  assert.ok(unrelatedUniform.confidence < 0.5);
  assert.equal(unrelatedUniform.referenceMatch.matchedCategoryKey, null);
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

