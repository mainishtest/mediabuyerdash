"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { PageHeader }   from "../../../components/ui/PageHeader";
import { SectionCard }  from "../../../components/ui/SectionCard";
import { Badge }        from "../../../components/ui/Badge";
import { ActionButton } from "../../../components/ui/ActionButton";
import { uploadCreativeImageAction } from "./actions";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UploadedImageSummary {
  id:             string;
  fileName:       string;
  mimeType:       string;
  fileSize:       number;
  storagePath:    string;
  uploadedAt:     Date;
  iterationCount: number;
  analysisStatus: string | null;
  clarityScore:   number | null;
  attentionScore: number | null;
  detectedStyle:  string | null;
}

interface Client {
  id:   string;
  name: string;
}

interface Props {
  images:  UploadedImageSummary[];
  clients: Client[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-600";
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-amber-400";
  return "text-rose-400";
}

function analysisVariant(status: string | null): "success" | "warning" | "neutral" {
  if (status === "completed") return "success";
  if (status === "pending")   return "warning";
  return "neutral";
}

// ── Upload area ────────────────────────────────────────────────────────────────

function UploadArea({
  clients,
  onSuccess,
}: {
  clients: Client[];
  onSuccess: (imageId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [preview,   setPreview]      = useState<string | null>(null);
  const [fileName,  setFileName]     = useState<string | null>(null);
  const [error,     setError]        = useState<string | null>(null);
  const [dragOver,  setDragOver]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(file: File | null) {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
    if (inputRef.current && file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputRef.current.files = dt.files;
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadCreativeImageAction(formData);
      if (result.success && result.imageId) {
        setPreview(null);
        setFileName(null);
        if (inputRef.current) inputRef.current.value = "";
        onSuccess(result.imageId);
      } else {
        setError(result.error ?? "Upload failed.");
      }
    });
  }

  return (
    <SectionCard
      title="Upload Image Creative"
      description="Upload a static ad image to analyse it and generate conversion-focused iteration concepts."
    >
      <form action={handleSubmit} className="space-y-4">

        {/* Drop zone */}
        <div
          className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center
            rounded-xl border-2 border-dashed transition-colors
            ${dragOver
              ? "border-emerald-500 bg-emerald-950/20"
              : preview
              ? "border-slate-600 bg-slate-800/40"
              : "border-slate-700 bg-slate-800/20 hover:border-slate-600"
            }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          {preview ? (
            <div className="relative h-36 w-full overflow-hidden rounded-lg px-4">
              <Image
                src={preview}
                alt="Preview"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-4 text-center">
              <svg className="h-8 w-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm font-medium text-slate-400">
                Drop an image here or <span className="text-emerald-400 underline">browse</span>
              </p>
              <p className="text-xs text-slate-600">JPG, PNG, WEBP · max 10 MB</p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
        </div>

        {fileName && (
          <p className="text-xs text-slate-400">
            Selected: <span className="font-medium text-slate-200">{fileName}</span>
          </p>
        )}

        {/* Client association (optional) */}
        {clients.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Associate with client <span className="text-slate-600">(optional)</span>
            </label>
            <select
              name="clientAccountId"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2
                text-sm text-slate-200 focus:border-emerald-600 focus:outline-none"
            >
              <option value="">— No client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Source copy (optional) */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">
            Source ad copy <span className="text-slate-600">(optional — used for copy variation generation)</span>
          </label>
          <textarea
            name="sourceCopy"
            rows={3}
            placeholder="Paste the existing ad copy here..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2
              text-sm text-slate-200 placeholder-slate-600 focus:border-emerald-600 focus:outline-none"
          />
        </div>

        {/* Source CTA (optional) */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">
            Call to action <span className="text-slate-600">(optional)</span>
          </label>
          <input
            type="text"
            name="sourceCallToAction"
            placeholder="e.g. Shop Now, Learn More, Get Started"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2
              text-sm text-slate-200 placeholder-slate-600 focus:border-emerald-600 focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/30 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <ActionButton
          type="submit"
          variant="primary"
          disabled={isPending || !fileName}
          className="w-full justify-center sm:w-auto"
        >
          {isPending ? "Uploading…" : "Upload Image"}
        </ActionButton>
      </form>
    </SectionCard>
  );
}

// ── Image card ─────────────────────────────────────────────────────────────────

function ImageCard({ image }: { image: UploadedImageSummary }) {
  return (
    <Link
      href={`/creative-lab/images/${image.id}`}
      className="group flex flex-col rounded-xl border border-slate-800 bg-slate-900/40
        transition-colors hover:border-slate-700 hover:bg-slate-900/60"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-slate-800">
        <Image
          src={image.storagePath}
          alt={image.fileName}
          fill
          className="object-cover transition-transform group-hover:scale-[1.02]"
          unoptimized
        />
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-slate-200 group-hover:text-white">
            {image.fileName}
          </p>
          <Badge variant={analysisVariant(image.analysisStatus)}>
            {image.analysisStatus ?? "Not analysed"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>{fileSizeLabel(image.fileSize)}</span>
          {image.detectedStyle && (
            <span className="capitalize">{image.detectedStyle.replace("-", " ")}</span>
          )}
          <span>{new Date(image.uploadedAt).toLocaleDateString()}</span>
        </div>

        {(image.clarityScore !== null || image.attentionScore !== null) && (
          <div className="flex items-center gap-4 text-xs">
            {image.clarityScore !== null && (
              <span>
                Clarity:{" "}
                <span className={`font-semibold ${scoreColor(image.clarityScore)}`}>
                  {image.clarityScore}/10
                </span>
              </span>
            )}
            {image.attentionScore !== null && (
              <span>
                Attention:{" "}
                <span className={`font-semibold ${scoreColor(image.attentionScore)}`}>
                  {image.attentionScore}/10
                </span>
              </span>
            )}
          </div>
        )}

        {image.iterationCount > 0 && (
          <p className="text-xs text-slate-500">
            {image.iterationCount} iteration concept{image.iterationCount !== 1 ? "s" : ""} generated
          </p>
        )}
      </div>
    </Link>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export function ImageUploadView({ images: initialImages, clients }: Props) {
  const [justUploaded, setJustUploaded] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">

      <PageHeader
        title="Image Creative Lab"
        description="Upload static ad images, analyse creative strengths and weaknesses, and generate iteration concepts based on Facebook direct-response best practices."
        badge={
          initialImages.length > 0
            ? <Badge variant="neutral">{initialImages.length} image{initialImages.length !== 1 ? "s" : ""}</Badge>
            : undefined
        }
      />

      {/* Success banner */}
      {justUploaded && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          Image uploaded.{" "}
          <Link
            href={`/creative-lab/images/${justUploaded}`}
            className="font-medium underline hover:text-emerald-200"
          >
            Analyse it now →
          </Link>
        </div>
      )}

      <UploadArea clients={clients} onSuccess={setJustUploaded} />

      {/* Library */}
      {initialImages.length > 0 ? (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">
            Uploaded Images
          </h2>
          {/* Mobile: single column, Desktop: 2–3 column grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {initialImages.map((img) => (
              <ImageCard key={img.id} image={img} />
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 py-16 text-center">
          <p className="text-sm text-slate-500">
            No images uploaded yet. Upload your first creative above.
          </p>
        </div>
      )}
    </div>
  );
}
