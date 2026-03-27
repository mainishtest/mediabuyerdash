"use server";

import { revalidatePath }    from "next/cache";
import { randomBytes }       from "crypto";
import { getServerSession }  from "next-auth";
import { authOptions }       from "../../../lib/auth";
import { prisma }            from "../../../lib/db";
import { writeImageFile, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "../../../lib/creativelab/storage";
import { analyzeCreativeImage }    from "../../../lib/creativelab/analysis";
import { generateConceptsForImage } from "../../../lib/creativelab/conceptGenerator";
import { updateConceptApproval }   from "../../../lib/creativelab/db";

// ── Upload ─────────────────────────────────────────────────────────────────────

export interface UploadResult {
  success:  boolean;
  imageId?: string;
  error?:   string;
}

export async function uploadCreativeImageAction(
  formData: FormData
): Promise<UploadResult> {
  const file     = formData.get("image");
  const clientId = formData.get("clientAccountId");

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
        id:              imageId,
        workspaceId:     workspaceId ?? undefined,
        clientAccountId: typeof clientId === "string" && clientId ? clientId : undefined,
        fileName:        stored.fileName,
        mimeType:        stored.mimeType,
        fileSize:        stored.fileSize,
        storagePath:     stored.storagePath,
      },
    });

    revalidatePath("/creative-lab/images");
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
