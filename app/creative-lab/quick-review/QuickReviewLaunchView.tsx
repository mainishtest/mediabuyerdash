"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface ReviewCandidate {
  id: string;
  generationRunId: string;
  variationType: "copy" | "image";
  title: string;
  hook?: string;
  body?: string;
  callToAction?: string;
  conceptSummary?: string;
  visualChanges?: string;
  goal?: string;
  generatedImageUrl?: string;
  approvalStatus: "draft" | "approved" | "rejected";
}

interface ReviewSet {
  generationRunId: string;
  clientAccountId: string;
  clientName?: string;
  sourceAdId?: string;
  sourceAdName?: string;
  copyCandidates: ReviewCandidate[];
  imageCandidates: ReviewCandidate[];
}

interface MetaTarget {
  adAccountId?: string;
  campaigns: { externalId: string; name: string }[];
  adSets: { externalId: string; name: string; campaignId: string }[];
}

interface LaunchBlocker {
  type: string;
  label: string;
  severity: "error" | "warning";
}

interface LaunchStatus {
  status: string;
  blockers: LaunchBlocker[];
  canLaunch: boolean;
}

interface LaunchResult {
  success: boolean;
  mode: string;
  message: string;
  metaCreativeId?: string;
  metaAdId?: string;
  errorCode?: string;
}

// ── Main View ────────────────────────────────────────────────────────────────

export function QuickReviewLaunchView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── State ──
  const [reviewSet, setReviewSet] = useState<ReviewSet | null>(null);
  const [metaTargets, setMetaTargets] = useState<MetaTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Target mapping
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedAdSet, setSelectedAdSet] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");

  // Launch state
  const [launchStatus, setLaunchStatus] = useState<LaunchStatus | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState(false);

  const runId = searchParams.get("runId");

  // ── Load review set ──
  useEffect(() => {
    if (!runId) {
      setLoading(false);
      setError("No generation run ID provided. Navigate here from Generate Variations.");
      return;
    }

    setLoading(true);
    fetch(`/api/creative-lab/quick-review?runId=${runId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setReviewSet(data.reviewSet);
          setMetaTargets(data.metaTargets || null);
        } else {
          setError(data.error || "Failed to load review set");
        }
      })
      .catch(() => setError("Failed to load review data"))
      .finally(() => setLoading(false));
  }, [runId]);

  // ── Approve/Reject handler ──
  const handleDecision = useCallback(
    async (candidate: ReviewCandidate, decision: "approved" | "rejected") => {
      if (!reviewSet) return;

      try {
        const response = await fetch("/api/creative-lab/quick-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: decision === "approved" ? "approve" : "reject",
            generationRunId: reviewSet.generationRunId,
            variationType: candidate.variationType,
            variationId: candidate.id,
          }),
        });

        const data = await response.json();
        if (data.ok) {
          // Update local state
          setReviewSet((prev) => {
            if (!prev) return prev;
            const updateList = (list: ReviewCandidate[]) =>
              list.map((c) =>
                c.id === candidate.id
                  ? { ...c, approvalStatus: decision }
                  : c.variationType === candidate.variationType && decision === "approved"
                    ? { ...c, approvalStatus: "rejected" as const } // Only one can be approved per type
                    : c
              );
            return {
              ...prev,
              copyCandidates: updateList(prev.copyCandidates),
              imageCandidates: updateList(prev.imageCandidates),
            };
          });
        }
      } catch {
        // Silently fail
      }
    },
    [reviewSet]
  );

  // ── Check launch readiness ──
  const handleCheckReadiness = useCallback(async () => {
    if (!reviewSet || !metaTargets) return;

    setCheckingReadiness(true);
    try {
      const response = await fetch("/api/creative-lab/quick-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check_readiness",
          generationRunId: reviewSet.generationRunId,
          target: {
            externalAdAccountId: metaTargets.adAccountId,
            targetCampaignExternalId: selectedCampaign || undefined,
            targetAdSetExternalId: selectedAdSet || undefined,
            destinationUrl: destinationUrl || undefined,
          },
        }),
      });

      const data = await response.json();
      if (data.ok) {
        setLaunchStatus(data.launchStatus);
      }
    } catch {
      // Silently fail
    } finally {
      setCheckingReadiness(false);
    }
  }, [reviewSet, metaTargets, selectedCampaign, selectedAdSet, destinationUrl]);

  // ── Launch handler ──
  const handleLaunch = useCallback(async () => {
    if (!reviewSet || !metaTargets) return;

    setLaunching(true);
    setLaunchResult(null);

    try {
      const response = await fetch("/api/creative-lab/quick-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "launch",
          generationRunId: reviewSet.generationRunId,
          target: {
            externalAdAccountId: metaTargets.adAccountId,
            targetCampaignExternalId: selectedCampaign || undefined,
            targetAdSetExternalId: selectedAdSet || undefined,
            destinationUrl: destinationUrl || undefined,
          },
          executionMode: "guarded_publish",
        }),
      });

      const data = await response.json();
      setLaunchResult(data.result || { success: false, mode: "guarded_publish", message: data.error || "Launch failed" });
    } catch {
      setLaunchResult({
        success: false,
        mode: "guarded_publish",
        message: "Launch request failed",
      });
    } finally {
      setLaunching(false);
    }
  }, [reviewSet, metaTargets, selectedCampaign, selectedAdSet, destinationUrl]);

  // ── Computed state ──
  const hasApprovedCopy = reviewSet?.copyCandidates.some((c) => c.approvalStatus === "approved") ?? false;
  const hasApprovedImage = reviewSet?.imageCandidates.some((c) => c.approvalStatus === "approved") ?? false;
  const hasApproval = hasApprovedCopy || hasApprovedImage;

  const filteredAdSets = metaTargets?.adSets.filter(
    (a) => !selectedCampaign || a.campaignId === selectedCampaign
  ) ?? [];

  // ── Loading state ──
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-center">
        <p className="text-slate-500">Loading review...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 space-y-4">
        <div className="rounded-lg border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
        <Link
          href="/creative-lab/variations"
          className="inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
        >
          Go to Generate Variations
        </Link>
      </div>
    );
  }

  if (!reviewSet) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Quick Review & Launch
        </h1>
        <p className="text-sm text-slate-400">
          Review generated variations, approve the best candidate, and launch a test to Meta.
        </p>
        {reviewSet.sourceAdName && (
          <p className="mt-1 text-xs text-slate-500">
            Source: {reviewSet.sourceAdName}
          </p>
        )}
      </div>

      {/* ── Copy Candidates ──────────────────────────────────────────────── */}
      {reviewSet.copyCandidates.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Copy Candidates
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {reviewSet.copyCandidates.map((c) => (
              <div
                key={c.id}
                className={`rounded-xl border p-4 space-y-3 transition-colors ${
                  c.approvalStatus === "approved"
                    ? "border-emerald-600 bg-emerald-950/20"
                    : c.approvalStatus === "rejected"
                      ? "border-slate-800 bg-slate-900/20 opacity-50"
                      : "border-slate-800 bg-slate-900/40"
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-medium text-white">{c.title}</h3>
                  {c.approvalStatus !== "draft" && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.approvalStatus === "approved"
                          ? "bg-emerald-950/50 text-emerald-300"
                          : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {c.approvalStatus}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  {c.hook && (
                    <div>
                      <p className="text-xs text-slate-500">Hook</p>
                      <p className="text-slate-200">{c.hook}</p>
                    </div>
                  )}
                  {c.body && (
                    <div>
                      <p className="text-xs text-slate-500">Body</p>
                      <p className="text-slate-300 text-xs leading-relaxed">{c.body}</p>
                    </div>
                  )}
                  {c.callToAction && (
                    <div>
                      <p className="text-xs text-slate-500">CTA</p>
                      <p className="font-medium text-emerald-300">{c.callToAction}</p>
                    </div>
                  )}
                </div>

                {/* Decision buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleDecision(c, "approved")}
                    disabled={c.approvalStatus === "approved"}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      c.approvalStatus === "approved"
                        ? "bg-emerald-900/50 text-emerald-200 cursor-default"
                        : "bg-emerald-900 text-emerald-100 hover:bg-emerald-800"
                    }`}
                  >
                    {c.approvalStatus === "approved" ? "Approved" : "Approve"}
                  </button>
                  <button
                    onClick={() => handleDecision(c, "rejected")}
                    disabled={c.approvalStatus === "rejected"}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      c.approvalStatus === "rejected"
                        ? "bg-slate-800/50 text-slate-500 cursor-default"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Image Candidates ─────────────────────────────────────────────── */}
      {reviewSet.imageCandidates.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Image Candidates
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {reviewSet.imageCandidates.map((c) => (
              <div
                key={c.id}
                className={`rounded-xl border p-4 space-y-3 transition-colors ${
                  c.approvalStatus === "approved"
                    ? "border-emerald-600 bg-emerald-950/20"
                    : c.approvalStatus === "rejected"
                      ? "border-slate-800 bg-slate-900/20 opacity-50"
                      : "border-slate-800 bg-slate-900/40"
                }`}
              >
                <h3 className="text-sm font-medium text-white">{c.title}</h3>

                {c.generatedImageUrl && (
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-800">
                    <Image
                      src={c.generatedImageUrl}
                      alt={c.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}

                <div className="space-y-1 text-xs">
                  {c.conceptSummary && (
                    <p className="text-slate-300">{c.conceptSummary}</p>
                  )}
                  {c.visualChanges && (
                    <p className="text-slate-500">{c.visualChanges}</p>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleDecision(c, "approved")}
                    disabled={c.approvalStatus === "approved"}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      c.approvalStatus === "approved"
                        ? "bg-emerald-900/50 text-emerald-200 cursor-default"
                        : "bg-emerald-900 text-emerald-100 hover:bg-emerald-800"
                    }`}
                  >
                    {c.approvalStatus === "approved" ? "Approved" : "Approve"}
                  </button>
                  <button
                    onClick={() => handleDecision(c, "rejected")}
                    disabled={c.approvalStatus === "rejected"}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      c.approvalStatus === "rejected"
                        ? "bg-slate-800/50 text-slate-500 cursor-default"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Launch Configuration ─────────────────────────────────────────── */}
      {hasApproval && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Launch Configuration
          </h2>

          {!metaTargets?.adAccountId && (
            <div className="rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
              No Meta ad account connected for this client. Connect one in Settings to enable
              guarded launch.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Campaign */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Target Campaign
              </label>
              <select
                value={selectedCampaign}
                onChange={(e) => {
                  setSelectedCampaign(e.target.value);
                  setSelectedAdSet("");
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
              >
                <option value="">— Select campaign —</option>
                {metaTargets?.campaigns.map((c) => (
                  <option key={c.externalId} value={c.externalId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Ad Set */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Target Ad Set
              </label>
              <select
                value={selectedAdSet}
                onChange={(e) => setSelectedAdSet(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
              >
                <option value="">— Select ad set —</option>
                {filteredAdSets.map((a) => (
                  <option key={a.externalId} value={a.externalId}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination URL */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Destination URL <span className="text-slate-600">(optional)</span>
              </label>
              <input
                type="text"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://example.com/landing"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Readiness check */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleCheckReadiness}
              disabled={checkingReadiness}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              {checkingReadiness ? "Checking…" : "Check Launch Readiness"}
            </button>

            {launchStatus && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  launchStatus.canLaunch
                    ? "bg-emerald-950/50 text-emerald-300"
                    : "bg-red-950/50 text-red-300"
                }`}
              >
                {launchStatus.canLaunch ? "Ready to Launch" : "Blocked"}
              </span>
            )}
          </div>

          {/* Blockers */}
          {launchStatus && launchStatus.blockers.length > 0 && (
            <div className="space-y-1">
              {launchStatus.blockers.map((b, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 text-xs ${
                    b.severity === "error"
                      ? "bg-red-950/30 text-red-400 border border-red-800"
                      : "bg-amber-950/30 text-amber-400 border border-amber-800"
                  }`}
                >
                  {b.label}
                </div>
              ))}
            </div>
          )}

          {/* Launch button */}
          {launchStatus?.canLaunch && (
            <button
              onClick={handleLaunch}
              disabled={launching}
              className={`rounded-lg px-6 py-2.5 text-sm font-medium transition-colors ${
                launching
                  ? "bg-emerald-950/30 text-emerald-300/50 cursor-not-allowed"
                  : "bg-emerald-900 text-emerald-100 hover:bg-emerald-800"
              }`}
            >
              {launching ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Launching to Meta…
                </span>
              ) : (
                "Launch Test to Meta"
              )}
            </button>
          )}
        </section>
      )}

      {/* ── Launch Result ────────────────────────────────────────────────── */}
      {launchResult && (
        <section
          className={`rounded-xl border p-5 space-y-3 ${
            launchResult.success
              ? "border-emerald-700 bg-emerald-950/30"
              : "border-red-800 bg-red-950/30"
          }`}
        >
          <h2 className="text-sm font-semibold text-white">
            {launchResult.success ? "Test Launched" : "Launch Failed"}
          </h2>
          <p className="text-sm text-slate-300">{launchResult.message}</p>

          {launchResult.metaAdId && (
            <div className="space-y-1 text-xs text-slate-400">
              <p>
                Meta Ad ID: <span className="font-mono text-slate-200">{launchResult.metaAdId}</span>
              </p>
              {launchResult.metaCreativeId && (
                <p>
                  Meta Creative ID:{" "}
                  <span className="font-mono text-slate-200">{launchResult.metaCreativeId}</span>
                </p>
              )}
              <p className="text-emerald-400">
                Ad created as PAUSED — enable it in Meta Ads Manager when ready.
              </p>
            </div>
          )}

          {launchResult.errorCode && (
            <p className="text-xs text-red-400">
              Error: {launchResult.errorCode}
              {launchResult.errorCode && ` — check Meta connection and try again`}
            </p>
          )}
        </section>
      )}

      {/* ── Action bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href={`/creative-lab/variations`}
          className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium bg-indigo-900 text-indigo-100 hover:bg-indigo-800 transition-colors"
        >
          Request Regeneration
        </Link>
        <Link
          href="/creative-lab"
          className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
        >
          Return to Source
        </Link>
      </div>
    </div>
  );
}
