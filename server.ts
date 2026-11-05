import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ROBOFLOW_WORKFLOW_URL,
  buildRoboflowWorkflowRequestBody,
  parseRoboflowWorkflowResponse,
} from './src/lib/mobilenetReportPipeline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  app.get('/api/classify-image/health', (_req, res) => {
    const workflowUrl =
      process.env.ROBOFLOW_WORKFLOW_URL?.trim() || ROBOFLOW_WORKFLOW_URL;
    const apiKeyConfigured = Boolean(process.env.ROBOFLOW_API_KEY?.trim());

    res.json({
      ok: true,
      provider: 'roboflow_workflow',
      workflowUrl,
      apiKeyConfigured,
      supportedClasses: ['drainage', 'road', 'streetlights', 'waste'],
    });
  });

  app.post('/api/classify-image', async (req, res) => {
    const startMs = Date.now();
    const workflowUrl =
      process.env.ROBOFLOW_WORKFLOW_URL?.trim() || ROBOFLOW_WORKFLOW_URL;
    const roboflowApiKey = process.env.ROBOFLOW_API_KEY?.trim();

    const {
      imageUrl,
      imageDataUrl,
      imageBase64,
      simulateError,
      mockPredictedClass,
      mockConfidence,
    } = (req.body ?? {}) as {
      imageUrl?: string | null;
      imageDataUrl?: string | null;
      imageBase64?: string | null;
      simulateError?: boolean;
      mockPredictedClass?: string | null;
      mockConfidence?: number | null;
    };

    if (simulateError) {
      res.status(200).json({
        modelStatus: 'error',
        provider: 'roboflow_workflow',
        workflowUrl,
        rawPredictedClass: null,
        predictedClass: null,
        confidence: null,
        errorCode: 'ROBOFLOW_UPSTREAM_ERROR',
        errorMessage:
          'Roboflow classifier service could not process the photo right now. You can select or change the report category (drainage, road, streetlights, or waste) manually below, or tap Retry Classification.',
      });
      return;
    }

    const primaryRequestBody = buildRoboflowWorkflowRequestBody({
      imageUrl,
      imageBase64: imageBase64 || imageDataUrl,
      preferBase64: false,
    });

    if (!primaryRequestBody) {
      res.status(400).json({
        modelStatus: 'error',
        provider: 'roboflow_workflow',
        workflowUrl,
        rawPredictedClass: null,
        predictedClass: null,
        confidence: null,
        errorCode: 'MISSING_IMAGE_INPUT',
        errorMessage:
          'No uploaded photo URL or image data was provided for classification.',
      });
      return;
    }

    // Allow deterministic test verification of the Roboflow response parser pipeline when mockPredictedClass is supplied
    if (typeof mockPredictedClass === 'string' && mockPredictedClass.trim()) {
      const parsed = parseRoboflowWorkflowResponse({
        outputs: [
          {
            predictions: {
              top: mockPredictedClass.trim(),
              confidence:
                typeof mockConfidence === 'number' ? mockConfidence : 0.92,
            },
          },
        ],
      });

      res.json({
        modelStatus: 'connected',
        provider: 'roboflow_workflow',
        modelName: 'four-class-classifier-test-1793801128146',
        workflowUrl,
        rawPredictedClass: parsed.rawPredictedClass,
        predictedClass: parsed.predictedClass,
        suggestedCategoryKey: parsed.matchedCategory?.key ?? null,
        suggestedCategoryLabel: parsed.matchedCategory?.label ?? null,
        confidence: parsed.confidence,
        classProbabilities: parsed.classProbabilities,
        inferenceTimeMs: Date.now() - startMs,
        aiGeneratedDescription:
          parsed.matchedCategory?.conservativeTemplate ?? null,
        descriptionSource: 'template_fallback',
      });
      return;
    }

    if (!roboflowApiKey) {
      res.status(200).json({
        modelStatus: 'not_connected',
        provider: 'roboflow_workflow',
        apiKeyConfigured: false,
        workflowUrl,
        rawPredictedClass: null,
        predictedClass: null,
        confidence: null,
        errorCode: 'MISSING_ROBOFLOW_API_KEY',
        errorMessage:
          'ROBOFLOW_API_KEY is not set in the server environment. Using local 4-class visual classifier fallback.',
      });
      return;
    }

    try {
      // API key goes in the Authorization header (inference v1.5.0+)
      let response = await fetch(workflowUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${roboflowApiKey}`,
        },
        body: JSON.stringify(primaryRequestBody),
      });

      // If URL fetch failed on Roboflow's side and we also have base64 image data, retry with base64 input
      if (
        !response.ok &&
        primaryRequestBody.inputs.image.type === 'url' &&
        (imageBase64 || imageDataUrl)
      ) {
        const base64FallbackBody = buildRoboflowWorkflowRequestBody({
          imageUrl,
          imageBase64: imageBase64 || imageDataUrl,
          preferBase64: true,
        });
        if (
          base64FallbackBody &&
          base64FallbackBody.inputs.image.type === 'base64'
        ) {
          response = await fetch(workflowUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${roboflowApiKey}`,
            },
            body: JSON.stringify(base64FallbackBody),
          });
        }
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        res.status(200).json({
          modelStatus: 'error',
          provider: 'roboflow_workflow',
          workflowUrl,
          rawPredictedClass: null,
          predictedClass: null,
          confidence: null,
          errorCode: `ROBOFLOW_HTTP_${response.status}`,
          errorMessage: `Roboflow classifier returned HTTP ${response.status}${
            errText ? `: ${errText.slice(0, 180)}` : ''
          }. You can still choose or change the report category below.`,
        });
        return;
      }

      const result = await response.json();
      const parsed = parseRoboflowWorkflowResponse(result);

      res.json({
        modelStatus: 'connected',
        provider: 'roboflow_workflow',
        modelName: 'four-class-classifier-test-1793801128146',
        workflowUrl,
        rawPredictedClass: parsed.rawPredictedClass,
        predictedClass: parsed.predictedClass,
        suggestedCategoryKey: parsed.matchedCategory?.key ?? null,
        suggestedCategoryLabel: parsed.matchedCategory?.label ?? null,
        confidence: parsed.confidence,
        classProbabilities: parsed.classProbabilities,
        inferenceTimeMs: Date.now() - startMs,
        aiGeneratedDescription:
          parsed.matchedCategory?.conservativeTemplate ?? null,
        descriptionSource: 'template_fallback',
      });
    } catch (error) {
      res.status(200).json({
        modelStatus: 'error',
        provider: 'roboflow_workflow',
        workflowUrl,
        rawPredictedClass: null,
        predictedClass: null,
        confidence: null,
        errorCode: 'ROBOFLOW_NETWORK_ERROR',
        errorMessage:
          (error as Error)?.message ||
          'Unable to reach Roboflow workflow endpoint. You can select a report category manually below.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CORA Server running on http://localhost:${PORT}`);
  });
}

void startServer();
