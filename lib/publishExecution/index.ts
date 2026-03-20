// lib/publishExecution/index.ts
// Public API for the Meta launch execution layer.
//
// Separation contract:
//   - This module accepts a validated PublishPayload only.
//   - It does NOT import from lib/publishPrep/ to avoid circular coupling.
//   - The caller (API route) orchestrates prep + execution.
//   - attemptMetaLaunch() never throws — always returns MetaLaunchResult.

export {
  attemptMetaLaunch,
  buildMetaAdCreativePayload,
} from "./metaLaunch";

export type {
  MetaLaunchMode,
  MetaLaunchResult,
  MetaAdCreativePayload,
} from "./metaLaunch";
