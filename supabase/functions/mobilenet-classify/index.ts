import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PURISIMA_CENTER = { lat: 9.0178894, lng: 126.2335553 };
const MAX_GPS_ACCURACY_METERS = 100;
const MAX_GPS_AGE_MS = 60_000;
const MAX_PURISIMA_SCOPE_METERS = 3500;

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function validateBackendGeofence(gps: {
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
  locationTimestamp?: number;
} | null) {
  if (
    !gps ||
    typeof gps.lat !== "number" ||
    typeof gps.lng !== "number" ||
    !Number.isFinite(gps.lat) ||
    !Number.isFinite(gps.lng)
  ) {
    return {
      isValid: false,
      isFresh: false,
      isAccurate: false,
      isWithinBarangayScope: false,
      distanceMeters: null,
      reason: "GPS coordinates are missing or invalid.",
    };
  }

  const now = Date.now();
  const ageMs =
    typeof gps.locationTimestamp === "number"
      ? Math.max(0, now - gps.locationTimestamp)
      : 0;
  const isFresh = ageMs <= MAX_GPS_AGE_MS;
  const isAccurate =
    typeof gps.accuracyMeters === "number" &&
    gps.accuracyMeters > 0 &&
    gps.accuracyMeters <= MAX_GPS_ACCURACY_METERS;
  const distanceMeters = Math.round(
    haversineMeters({ lat: gps.lat, lng: gps.lng }, PURISIMA_CENTER)
  );
  const isWithinBarangayScope = distanceMeters <= MAX_PURISIMA_SCOPE_METERS;

  return {
    isValid: isFresh && isAccurate && isWithinBarangayScope,
    isFresh,
    isAccurate,
    isWithinBarangayScope,
    distanceMeters,
    reason:
      isFresh && isAccurate && isWithinBarangayScope
        ? "Verified within Barangay Purisima geofence scope."
        : "Coordinates did not pass backend freshness, accuracy (<=100m), or Barangay Purisima scope checks.",
  };
}

async function generateSupportingDescription(
  imageSource: string,
  categoryLabel: string
): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || !imageSource || !categoryLabel) return null;

  try {
    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are an AI reporting assistant for the CORA barangay reporting system in Barangay Purisima, Tago, Surigao del Sur.
The identified concern category is: "${categoryLabel}".
Write a clear, concise, factual 2-sentence report description based on this category and the submitted photo.
Strict rules:
- Use respectful, professional language understandable to barangay residents.
- Do NOT invent damage severity, causes, measurements, or hazards.
- Do NOT claim that the problem has been officially verified.
- Do NOT assume details that are not visible or supported.
- Output ONLY the 2-sentence plain text description.`,
                },
                {
                  type: "image_url",
                  image_url: { url: imageSource },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    return content && content.length >= 25 && content.length <= 500
      ? content
      : null;
  } catch {
    return null;
  }
}

async function classifyAndDescribeWithVisionGateway(
  imageSource: string
): Promise<{
  predictedClass: string | null;
  confidence: number | null;
  aiGeneratedDescription: string | null;
} | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || !imageSource) return null;

  try {
    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are the community concern image analyzer for Barangay Purisima, Tago, Surigao del Sur.
Analyze the submitted photo and classify it into ONE of the following four supported categories:
1. "Improper Waste Disposal" (uncollected garbage, litter, illegal dumping, roadside trash)
2. "Streetlight Problem" (broken, unlit, flickering, or damaged street lighting fixtures/poles)
3. "Drainage/Flooding Concern" (clogged canal, blocked drainage, standing floodwater, overflowing waterway)
4. "Road Damage" (potholes, cracked concrete road, damaged pavement or public pathway)

If the image does not clearly show any of these four community concerns, set "predictedClass" to "unrecognized" and "confidence" below 0.50.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "predictedClass": "Improper Waste Disposal" | "Streetlight Problem" | "Drainage/Flooding Concern" | "Road Damage" | "unrecognized",
  "confidence": 0.88,
  "description": "Clear, factual 2-sentence description of the visible community concern without inventing measurements or claiming official verification."
}`,
                },
                {
                  type: "image_url",
                  image_url: { url: imageSource },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";
    if (content.startsWith("```")) {
      content = content.replace(/```(?:json)?\n?/g, "").trim();
    }
    const parsed = JSON.parse(content);
    const rawConf =
      typeof parsed.confidence === "number" ? parsed.confidence : null;
    const normalizedConfidence =
      rawConf !== null && rawConf > 1 ? rawConf / 100 : rawConf;
    const desc =
      typeof parsed.description === "string" &&
      parsed.description.trim().length >= 25
        ? parsed.description.trim()
        : null;

    return {
      predictedClass:
        parsed.predictedClass && parsed.predictedClass !== "unrecognized"
          ? parsed.predictedClass
          : null,
      confidence: normalizedConfidence,
      aiGeneratedDescription: desc,
    };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { imageUrl, imageDataUrl, gps, confirmedCategoryLabel } = body ?? {};
    const effectiveImageSource = imageDataUrl || imageUrl;

    const geofenceValidation = validateBackendGeofence(gps ?? null);

    // If caller only requested supporting description generation for a confirmed category
    if (confirmedCategoryLabel && effectiveImageSource) {
      const desc = await generateSupportingDescription(
        effectiveImageSource,
        confirmedCategoryLabel
      );
      return new Response(
        JSON.stringify({
          aiGeneratedDescription: desc,
          descriptionSource: desc ? "ai_service" : "template_fallback",
          geofenceValidation,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const startMs = Date.now();
    // Secrets are stored as Roboflow_API / Roboflow_URL; keep ROBOFLOW_* aliases for compatibility.
    const roboflowApiKey = (
      Deno.env.get("Roboflow_API") ?? Deno.env.get("ROBOFLOW_API_KEY") ?? ""
    )
      .trim();
    const roboflowWorkflowUrl = (
      Deno.env.get("Roboflow_URL") ??
      Deno.env.get("ROBOFLOW_WORKFLOW_URL") ??
      ""
    )
      .trim() ||
      "https://serverless.roboflow.com/gwen-apuli/workflows/four-class-classifier-test-1793801128146";

    if (roboflowApiKey && effectiveImageSource) {
      const isPublicUrl =
        /^https?:\/\//i.test(effectiveImageSource) &&
        !effectiveImageSource.includes("localhost") &&
        !effectiveImageSource.includes("127.0.0.1");
      const base64Match = effectiveImageSource.match(
        /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/i
      );
      const imageInput = isPublicUrl
        ? { type: "url", value: effectiveImageSource }
        : {
            type: "base64",
            value: base64Match ? base64Match[1] : effectiveImageSource,
          };

      const rfResponse = await fetch(roboflowWorkflowUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${roboflowApiKey}`,
        },
        body: JSON.stringify({
          inputs: {
            image: imageInput,
          },
        }),
      });

      if (rfResponse.ok) {
        const rfResult = await rfResponse.json();
        const firstOutput = Array.isArray(rfResult?.outputs)
          ? rfResult.outputs[0]
          : rfResult;
        const predBlock =
          firstOutput?.predictions ??
          firstOutput?.model_predictions ??
          firstOutput;
        const rawClass = (
          predBlock?.top ??
          (Array.isArray(predBlock?.predicted_classes)
            ? predBlock.predicted_classes[0]
            : null) ??
          predBlock?.predictedClass ??
          predBlock?.class ??
          ""
        )
          .toString()
          .trim()
          .toLowerCase();

        const rawConf =
          typeof predBlock?.confidence === "number"
            ? predBlock.confidence
            : Array.isArray(predBlock?.predictions) &&
              typeof predBlock.predictions[0]?.confidence === "number"
            ? predBlock.predictions[0].confidence
            : null;
        const normalizedConfidence =
          rawConf !== null && rawConf > 1 ? rawConf / 100 : rawConf;

        const classMap: Record<string, string> = {
          drainage: "Drainage/Flooding Concern",
          road: "Road Damage",
          streetlights: "Streetlight Problem",
          streetlight: "Streetlight Problem",
          waste: "Improper Waste Disposal",
          garbage: "Improper Waste Disposal",
        };
        const predictedClass = classMap[rawClass] || rawClass || null;

        let aiGeneratedDescription: string | null = null;
        if (
          predictedClass &&
          normalizedConfidence !== null &&
          normalizedConfidence >= 0.65
        ) {
          aiGeneratedDescription = await generateSupportingDescription(
            effectiveImageSource,
            predictedClass
          );
        }

        return new Response(
          JSON.stringify({
            modelStatus: "connected",
            rawPredictedClass: rawClass || null,
            predictedClass,
            confidence: normalizedConfidence,
            inferenceTimeMs: Date.now() - startMs,
            aiGeneratedDescription,
            descriptionSource: aiGeneratedDescription
              ? "ai_service"
              : "template_fallback",
            geofenceValidation,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const mobilenetEndpoint = Deno.env.get("MOBILENETV3_MODEL_URL");

    if (mobilenetEndpoint) {
      const upstream = await fetch(mobilenetEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: effectiveImageSource }),
      });

      if (upstream.ok) {
        const result = await upstream.json();
        const predictedClass =
          result.predictedClass ?? result.category ?? result.label ?? null;
        const confidence =
          typeof result.confidence === "number" ? result.confidence : null;
        const normalizedConfidence =
          confidence !== null && confidence > 1 ? confidence / 100 : confidence;

        let aiGeneratedDescription: string | null = null;
        if (
          predictedClass &&
          normalizedConfidence !== null &&
          normalizedConfidence >= 0.65 &&
          effectiveImageSource
        ) {
          aiGeneratedDescription = await generateSupportingDescription(
            effectiveImageSource,
            predictedClass
          );
        }

        return new Response(
          JSON.stringify({
            modelStatus: "connected",
            predictedClass,
            confidence: normalizedConfidence,
            classProbabilities: result.classProbabilities ?? undefined,
            inferenceTimeMs: Date.now() - startMs,
            aiGeneratedDescription,
            descriptionSource: aiGeneratedDescription
              ? "ai_service"
              : "template_fallback",
            geofenceValidation,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Fallback to AI Vision Gateway when external model URL is not set
    if (effectiveImageSource) {
      const visionResult = await classifyAndDescribeWithVisionGateway(
        effectiveImageSource
      );
      if (visionResult) {
        return new Response(
          JSON.stringify({
            modelStatus: "connected",
            predictedClass: visionResult.predictedClass,
            confidence: visionResult.confidence,
            inferenceTimeMs: Date.now() - startMs,
            aiGeneratedDescription: visionResult.aiGeneratedDescription,
            descriptionSource: visionResult.aiGeneratedDescription
              ? "ai_service"
              : "template_fallback",
            geofenceValidation,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        modelStatus: "not_connected",
        predictedClass: null,
        confidence: null,
        descriptionSource: "none",
        geofenceValidation,
        errorMessage:
          "We could not automatically analyze this photo right now. Please retake the photo or select the concern category below.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        modelStatus: "error",
        predictedClass: null,
        confidence: null,
        errorMessage:
          (error as Error).message || "Image analysis could not be completed.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
