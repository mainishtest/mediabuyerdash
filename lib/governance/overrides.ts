// lib/governance/overrides.ts
// Operator override management.
//
// Overrides are explicit, scoped, and traceable. Every override requires:
//  - A reason (free text, required)
//  - A scope and scopeId
//  - An optional expiry (if omitted, must be manually cleared)
//
// High-risk override types (override_block) are permitted but flagged.
// All overrides surface as GovernanceFlags in the approval routing layer.

import { prisma } from "../db";
import type {
  AutomationOverrideRecord,
  ApplyOverrideInput,
  DeferActionInput,
  EscalateActionInput,
  GovernanceFlag,
} from "./types";

import {
  createAutomationOverride,
  clearAutomationOverride,
  getActiveOverrides,
  getActiveOverridesForScope,
} from "./persist";

// ---------------------------------------------------------------------------
// Apply / clear overrides
// ---------------------------------------------------------------------------

/**
 * Apply an operator override. Always creates a new record — overrides stack
 * and must each be cleared individually. This makes the governance trail explicit.
 */
export async function applyAutomationOverride(
  input: ApplyOverrideInput
): Promise<AutomationOverrideRecord> {
  return createAutomationOverride(input);
}

/**
 * Clear an active override by ID. Non-destructive — sets isActive=false.
 */
export async function clearOverride(
  overrideId: string,
  clearedBy:  string | null
): Promise<AutomationOverrideRecord | null> {
  return clearAutomationOverride(overrideId, clearedBy);
}

/**
 * Load all active overrides for a workspace. Used by the governance UI.
 */
export async function loadActiveOverrides(
  workspaceId: string
): Promise<AutomationOverrideRecord[]> {
  return getActiveOverrides(workspaceId);
}

// ---------------------------------------------------------------------------
// Defer action
// ---------------------------------------------------------------------------

/**
 * Defer a proposed action. Sets status="deferred" on the action and creates
 * a linked AutomationOverride record for the audit trail.
 *
 * Deferred actions resurface in the governance UI. Operators can un-defer
 * by approving, rejecting, or escalating the action directly.
 */
export async function deferAction(
  input: DeferActionInput
): Promise<{ actionId: string; override: AutomationOverrideRecord }> {
  const [, override] = await Promise.all([
    prisma.proposedAutomationAction.update({
      where: { id: input.actionId },
      data: {
        status:       "deferred",
        deferredUntil: input.deferUntil ?? null,
      },
    }),
    createAutomationOverride({
      workspaceId:  input.workspaceId,
      overrideType: "defer_action",
      scope:        "client",        // defer is always action-scoped; scope=client as fallback
      scopeId:      "action",        // use "action" sentinel; actionId is the real key
      actionId:     input.actionId,
      reason:       input.reason,
      appliedBy:    input.appliedBy,
      expiresAt:    input.deferUntil,
      metadata:     { deferUntil: input.deferUntil?.toISOString() ?? null },
    }),
  ]);

  return { actionId: input.actionId, override };
}

// ---------------------------------------------------------------------------
// Escalate action
// ---------------------------------------------------------------------------

/**
 * Escalate a proposed action to elevated review. Sets status="escalated" on
 * the action and creates a linked AutomationOverride record.
 *
 * Escalated actions appear in the "Escalations" section of the governance UI.
 * They can only be resolved by approval or rejection (not auto-execution).
 */
export async function escalateAction(
  input: EscalateActionInput
): Promise<{ actionId: string; override: AutomationOverrideRecord }> {
  const [, override] = await Promise.all([
    prisma.proposedAutomationAction.update({
      where: { id: input.actionId },
      data: {
        status:        "escalated",
        escalatedAt:   new Date(),
        escalationNote: input.escalationNote,
      },
    }),
    createAutomationOverride({
      workspaceId:  input.workspaceId,
      overrideType: "require_approval_all",  // elevates the approval requirement
      scope:        "client",
      scopeId:      "action",
      actionId:     input.actionId,
      reason:       input.escalationNote,
      appliedBy:    input.appliedBy,
      metadata:     { escalatedAt: new Date().toISOString(), note: input.escalationNote },
    }),
  ]);

  return { actionId: input.actionId, override };
}

// ---------------------------------------------------------------------------
// Flag helpers
// ---------------------------------------------------------------------------

/**
 * Convert active overrides into GovernanceFlag objects for the routing layer.
 */
export function overridesToGovernanceFlags(
  overrides: AutomationOverrideRecord[]
): GovernanceFlag[] {
  return overrides
    .filter((o) => o.overrideType !== "resume_scope")
    .map((o) => ({
      type:    "override_active" as const,
      scope:   o.scope,
      scopeId: o.scopeId,
      message: `Override "${o.overrideType}" active: "${o.reason}"`,
    }));
}

/**
 * Check if a scope-pause or require_approval_all override is active for a scope.
 * Used by routing to elevate the review requirement even in guarded_auto_execute mode.
 */
export async function isScopePausedOrOverridden(
  workspaceId: string,
  scope:       string,
  scopeId:     string
): Promise<boolean> {
  const overrides = await getActiveOverridesForScope(workspaceId, scope, scopeId);
  return overrides.some(
    (o) =>
      o.overrideType === "pause_scope" ||
      o.overrideType === "require_approval_all"
  );
}
