"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
}

interface SourceAsset {
  id: string;
  label: string | null;
  hook: string | null;
  bodyText: string | null;
  callToAction: string | null;
  imageHeadline: string | null;
  imageUrl: string | null;
  assetType: string;
  createdAt: string;
  clientAccountId: string;
  notes: string | null;
}

// ── Upload Area Component ──────────────────────────────────────────────────────

function UploadArea({
  onFileSelected,
  preview,
  fileName,
  dragOver,
  setDragOver,
}: {
  onFileSelected: (file: File) => void;
  preview: string | null;
  fileName: string | null;
  dragOver: boolean;
  setDragOver: (over: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(file: File | null) {
    if (!file) return;
    onFileSelected(file);
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

  return (
    <div
      className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center
        rounded-xl border-2 border-dashed transition-colors
        ${
          dragOver
            ? "border-emerald-500 bg-emerald-950/20"
            : preview
              ? "border-slate-600 bg-slate-800/40"
              : "border-slate-700 bg-slate-800/20 hover:border-slate-600"
        }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      {preview ? (
        <div className="relative h-36 w-full overflow-hidden rounded-lg px-4">
          <Image src={preview} alt="Preview" fill className="object-contain" unoptimized />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-6 py-4 text-center">
          <svg className="h-8 w-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-sm font-medium text-slate-400">
            Drop an image here or <span className="text-emerald-400 underline">browse</span>
          </p>
          <p className="text-xs text-slate-600">JPG, PNG, WEBP, GIF · max 10 MB</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        name="image"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

// ── Source Asset Card (for library) ────────────────────────────────────────────

function SourceAssetCard({
  asset,
  onSelect,
}: {
  asset: SourceAsset;
  onSelect: (asset: SourceAsset) => void;
}) {
  const thumbnail = asset.imageUrl;
  const displayDate = new Date(asset.createdAt).toLocaleDateString();
  const copyPreview = asset.hook || asset.bodyText || "No copy";

  return (
    <button
      onClick={() => onSelect(asset)}
      className="group flex flex-col rounded-xl border border-slate-800 bg-slate-900/40
        transition-colors hover:border-slate-700 hover:bg-slate-900/60 text-left"
    >
      {/* Thumbnail */}
      {thumbnail ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-slate-800">
          <Image
            src={thumbnail}
            alt={asset.label || "Asset image"}
            fill
            className="object-cover transition-transform group-hover:scale-[1.02]"
            unoptimized
          />
        </div>
      ) : (
        <div className="relative aspect-video w-full rounded-t-xl bg-slate-800 flex items-center justify-center">
          <p className="text-xs text-slate-600">No image</p>
        </div>
      )}

      {/* Metadata */}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-slate-200 group-hover:text-white">
            {asset.label || "Untitled Asset"}
          </p>
          <span className="inline-block rounded-full bg-indigo-950/50 px-2 py-0.5 text-xs text-indigo-300">
            {asset.assetType === "uploaded_image" ? "Image" :
             asset.assetType === "uploaded_copy" ? "Copy" :
             asset.assetType === "uploaded_image_and_copy" ? "Image + Copy" :
             "Asset"}
          </span>
        </div>

        <p className="line-clamp-2 text-xs text-slate-500">{copyPreview}</p>

        <p className="text-xs text-slate-600">{displayDate}</p>
      </div>
    </button>
  );
}

// ── Main View ──────────────────────────────────────────────────────────────────

export function UploadSourceAssetView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // File & preview
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Source copy fields
  const [hook, setHook] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [cta, setCta] = useState("");
  const [imageHeadline, setImageHeadline] = useState("");

  // Metadata
  const [label, setLabel] = useState("");
  const [clientAccountId, setClientAccountId] = useState("");
  const [notes, setNotes] = useState("");

  // Clients & assets
  const [clients, setClients] = useState<Client[]>([]);
  const [existingAssets, setExistingAssets] = useState<SourceAsset[]>([]);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load clients on mount
  useEffect(() => {
    fetch("/api/creative-lab/quick-generate/clients")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.clients) setClients(data.clients);
      })
      .catch(() => {});
  }, []);

  // Load existing assets when client changes
  useEffect(() => {
    if (!clientAccountId) {
      setExistingAssets([]);
      return;
    }

    fetch(`/api/creative-source-assets?clientId=${clientAccountId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.assets) setExistingAssets(data.assets);
      })
      .catch(() => {});
  }, [clientAccountId]);

  // Handle file selection
  const handleFileSelected = useCallback((selectedFile: File) => {
    setError(null);
    setFileName(selectedFile.name);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selectedFile);
    setFile(selectedFile);
  }, []);

  // Handle save
  const handleSave = async (openInQuickGenerate: boolean = false) => {
    if (!file) {
      setError("Please select an image file");
      return;
    }

    if (!label) {
      setError("Please provide an asset label");
      return;
    }

    if (!clientAccountId) {
      setError("Please select a client");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("label", label);
      formData.append("clientAccountId", clientAccountId);
      formData.append("hook", hook);
      formData.append("bodyText", bodyText);
      formData.append("cta", cta);
      formData.append("imageHeadline", imageHeadline);
      formData.append("notes", notes);

      const response = await fetch("/api/creative-source-assets", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || "Failed to save asset");
        setSaving(false);
        return;
      }

      const savedAsset = data.asset;
      setSuccess("Source asset saved successfully");

      // Reset form
      setFile(null);
      setPreview(null);
      setFileName(null);
      setHook("");
      setBodyText("");
      setCta("");
      setImageHeadline("");
      setLabel("");
      setNotes("");

      // Reload assets for the client
      fetch(`/api/creative-source-assets?clientId=${clientAccountId}`)
        .then((r) => r.json())
        .then((newData) => {
          if (newData.assets) setExistingAssets(newData.assets);
        })
        .catch(() => {});

      if (openInQuickGenerate && savedAsset?.id) {
        setTimeout(() => {
          router.push(`/creative-lab/variations?assetId=${savedAsset.id}&clientId=${clientAccountId}`);
        }, 500);
      }
    } catch (err) {
      setError("An error occurred while saving the asset");
    } finally {
      setSaving(false);
    }
  };

  // Handle using an existing asset in Generate Variations
  const handleUseInQuickGenerate = (asset: SourceAsset) => {
    router.push(`/creative-lab/variations?assetId=${asset.id}&clientId=${clientAccountId}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Upload Source Asset</h1>
        <p className="text-sm text-slate-400">
          Upload an image and optional source copy to create a reusable creative asset for the Creative Lab
          pipeline.
        </p>
      </div>

      {/* Success Banner */}
      {success && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 px-3 py-2 text-sm text-red-400">{error}</div>
      )}

      {/* Upload Area Section */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">Image</h2>
        <UploadArea
          onFileSelected={handleFileSelected}
          preview={preview}
          fileName={fileName}
          dragOver={dragOver}
          setDragOver={setDragOver}
        />
        {fileName && (
          <p className="mt-3 text-xs text-slate-400">
            Selected: <span className="font-medium text-slate-200">{fileName}</span>
          </p>
        )}
      </section>

      {/* Source Copy Section */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">Source Copy</h2>
        <div className="space-y-4">
          {/* Hook */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Hook <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Opening hook / scroll-stop line"
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {/* Body Text */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Body Text <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              placeholder="Main ad body text"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {/* Call to Action */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Call to Action <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="CTA button label"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {/* Image Headline */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Image Headline <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Overlaid headline text on the image"
              value={imageHeadline}
              onChange={(e) => setImageHeadline(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Asset Metadata Section */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">Asset Metadata</h2>
        <div className="space-y-4">
          {/* Label */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Label</label>
            <input
              type="text"
              placeholder="Give this asset a friendly name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {/* Client Selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Client</label>
            <select
              value={clientAccountId}
              onChange={(e) => setClientAccountId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
            >
              <option value="">— Select a client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Notes <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              placeholder="Internal notes about this asset"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => handleSave(false)}
          disabled={saving || !file}
          className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors
            ${
              saving || !file
                ? "bg-emerald-950/30 text-emerald-300/50 cursor-not-allowed"
                : "bg-emerald-900 text-emerald-100 hover:bg-emerald-800"
            }`}
        >
          {saving ? "Saving…" : "Save Source Asset"}
        </button>

        <button
          onClick={() => handleSave(true)}
          disabled={saving || !file}
          className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors
            ${
              saving || !file
                ? "bg-indigo-950/30 text-indigo-300/50 cursor-not-allowed"
                : "bg-indigo-900 text-indigo-100 hover:bg-indigo-800"
            }`}
        >
          {saving ? "Saving…" : "Save & Open in Quick Generate"}
        </button>

        <Link
          href="/creative-lab"
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium
            bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
        >
          Cancel
        </Link>
      </div>

      {/* Saved Assets Library */}
      {clientAccountId && existingAssets.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">
            {clients.find((c) => c.id === clientAccountId)?.name || "Client"}&apos;s Assets
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {existingAssets.map((asset) => (
              <div key={asset.id} className="relative">
                <SourceAssetCard asset={asset} onSelect={handleUseInQuickGenerate} />
                <button
                  onClick={() => handleUseInQuickGenerate(asset)}
                  className="absolute inset-0 rounded-xl bg-black/40 opacity-0 transition-opacity hover:opacity-100 flex items-center justify-center"
                >
                  <span className="text-sm font-medium text-white">Use in Quick Generate</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {clientAccountId && existingAssets.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-800 py-12 text-center">
          <p className="text-sm text-slate-500">No assets for this client yet. Create one above.</p>
        </div>
      )}
    </div>
  );
}
