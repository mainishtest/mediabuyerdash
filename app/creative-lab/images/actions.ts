"use server";

import { revalidatePath }    from "next/cache";
import { randomBytes }       from "crypto";
import { getServerSession }  from "next-auth";
import { authOptions }       from "../../../lib/auth";
import { prisma }            from "../../../lib/db";
import { writeImageFile, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, downloadAndStoreGeneratedImage } from "../../../lib/creativelab/storage";
import { analyzeCreativeImage }    from "../../../lib/creativelab/analysis";
import { generateConceptsForImage } from "../../../lib/creativelab/conceptGenerator";
import { updateConceptApproval }   from "../../../lib/creativelab/db";
import { buildImagePrompt, generateImageWithRetry, MAX_IMAGES_PER_REQUEST } from "../../../lib/creativelab/imageGeneration";

// ── Upload ─────────────────────────────────────────────────────────────────────

export interface UploadResult {
  success:  boolean;
  imageId?: string;
  error?:   string;
}

export async function uploadCreativeImageAction(
  formData: FormData
): Promise<UploadResult> {
  const file              = formData.get("image");
  const clientId          = formData.get("clientAccountId");
  const sourceCopy        = formData.get("sourceCopy");
  const sourceCallToAction = formData.get("sourceCallToAction");

  if (!(file instanceof File) || !file.name) {
    return { success: false, error: "No file provided." };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { success: false, error: `Unsupported file type: ${file.type}. Allowed: JPG, PNG, WEBP.` };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { success: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.` };
  }
  if (file.size === 0) {
    return { success: false, error: "File is empty." };
  }

  const session    = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const imageId = randomBytes(12).toString("hex"); // 24-char hex id

  try {
    const stored = await writeImageFile(imageId, file);

    await prisma.uploadedCreativeImage.create({
      data: {
        id:                 imageId,
        workspaceId:        workspaceId ?? undefined,
        clientAccountId:    typeof clientId === "string" && clientId ? clientId : undefined,
        fileName:           stored.fileName,
        mimeType:           stored.mimeType,
        fileSize:           stored.fileSize,
        storagePath:        stored.storagePath,
        sourceCopy:         typeof sourceCopy === "string" && sourceCopy.trim() ? sourceCopy.trim() : undefined,
        sourceCallToAction: typeof sourceCallToAction === "string" && sourceCallToAction.trim() ? sourceCallToAction.trim() : undefined,
      },
    });

    revalidatePath("/creative-lab/images");
    revalidatePath("/creative-lab");
    return { success: true, imageId };
  } catch (err) {
    console.error("[uploadCreativeImageAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }
}

// ── Analyze ────────────────────────────────────────────────────────────────────

export interface AnalyzeResult {
  success: boolean;
  error?:  string;
}

export async function analyzeCreativeImageAction(
  imageId: string
): Promise<AnalyzeResult> {
  try {
    await analyzeCreativeImage(imageId);
    revalidatePath(`/creative-lab/images/${imageId}`);
    revalidatePath("/creative-lab/images");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Analysis failed.",
    };
  }
}

// ── Generate concepts ──────────────────────────────────────────────────────────

export interface GenerateConceptsResult {
  success: boolean;
  error?:  string;
}

export async function generateConceptsAction(
  imageId: string
): Promise<GenerateConceptsResult> {
  // Analysis must exist before generating concepts
  const analysis = await prisma.uploadedCreativeAnalysis.findUnique({
    where: { uploadedCreativeImageId: imageId },
  });
  if (!analysis || analysis.analysisStatus !== "completed") {
    // Auto-run analysis first if missing
    try {
      await analyzeCreativeImage(imageId);
    } catch (err) {
      return {
        success: false,
        error: `Analysis required first. Failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  try {
    await generateConceptsForImage(imageId);
    revalidatePath(`/creative-lab/images/${imageId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Concept generation failed.",
    };
  }
}

// ── Approve / Reject concept ───────────────────────────────────────────────────

export async function updateConceptApprovalAction(
  conceptId: string,
  status: "approved" | "rejected" | "draft",
  imageId: string
): Promise<void> {
  await updateConceptApproval(conceptId, status);
  revalidatePath(`/creative-lab/images/${imageId}`);
}

// ── Generate real image for a concept ─────────────────────────────────────────

export interface GenerateImageResult {
  success:   boolean;
  imagePath?: string;
  error?:    string;
}

/**
 * Generate a real AI image for a single concept using OpenAI DALL-E 3.
 * Downloads the result and stores it locally.
 */
export async function generateConceptImageAction(
  conceptId: string,
  imageId: string
): Promise<GenerateImageResult> {
  // Load concept + source analysis for prompt context
  const concept = await prisma.generatedImageIterationConcept.findUnique({
    where: { id: conceptId },
    include: {
      image: {
        include: { analysis: true },
      },
    },
  });

  if (!concept) {
    return { success: false, error: "Concept not found." };
  }

  // Mark as generating
  await prisma.generatedImageIterationConcept.update({
    where: { id: conceptId },
    data: { generationStatus: "generating", generationError: null },
  });

  try {
    // Build prompt from concept + analysis context
    const prompt = buildImagePrompt(
      {
        title:          concept.title,
        conceptSummary: concept.conceptSummary,
        visualChanges:  concept.visualChanges,
        goal:           concept.goal,
      },
      concept.image.analysis
    );

    // Call OpenAI DALL-E 3
    const result = await generateImageWithRetry({ prompt });

    if (result.status !== "completed" || !result.imageUrl) {
      await prisma.generatedImageIterationConcept.update({
        where: { id: conceptId },
        data: {
          generationStatus: "failed",
          generationError:  result.error ?? "Generation failed",
          generationPrompt: prompt,
          generationProvider: "openai_dalle3",
        },
      });
      return { success: false, error: result.error ?? "Image generation failed." };
    }

    // Download and store the generated image
    const stored = await downloadAndStoreGeneratedImage(conceptId, result.imageUrl);

    // Update concept record
    await prisma.generatedImageIterationConcept.update({
      where: { id: conceptId },
      data: {
        generationStatus:    "completed",
        generatedImagePath:  stored.storagePath,
        generationProvider:  "openai_dalle3",
        generationPrompt:    result.prompt,
        generationError:     null,
        generatedAt:         new Date(),
      },
    });

    revalidatePath(`/creative-lab/images/${imageId}`);
    return { success: true, imagePath: stored.storagePath };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await prisma.generatedImageIterationConcept.update({
      where: { id: conceptId },
      data: {
        generationStatus: "failed",
        generationError:  errorMsg,
      },
    });
    return { success: false, error: errorMsg };
  }
}

/**
 * Generate images for all pending concepts of an uploaded image.
 * Cost-limited to MAX_IMAGES_PER_REQUEST concepts per call.
 */
export async function generateAllConceptImagesAction(
  imageId: string
): Promise<{ success: boolean; generated: number; failed: number; error?: string }> {
  const concepts = await prisma.generatedImageIterationConcept.findMany({
    where: {
      uploadedCreativeImageId: imageId,
      generationStatus: { in: ["pending", "failed"] },
    },
    take: MAX_IMAGES_PER_REQUEST,
  });

  if (concepts.length === 0) {
    return { success: true, generated: 0, failed: 0 };
  }

  let generated = 0;
  let failed = 0;

  for (const concept of concepts) {
    const result = await generateConceptImageAction(concept.id, imageId);
    if (result.success) generated++;
    else failed++;
  }

  revalidatePath(`/creative-lab/images/${imageId}`);
  return { success: true, generated, failed };
}
