// lib/policy/persist.ts
// Database access for ActionSafetyPolicy records.
//
// All JSON fields (allowedActionTypes, blockedActionTypes, approvalRequired, constraints)
// are stored as String in Postgres and parsed/serialised here.

import { prisma } from "../db";
import type {
  ActionSafetyPolicyRecord,
  ActionSafetyScope,
  ActionType,
  ActionConstraint,
  PolicyEvaluationContext,
  UpsertPolicyInput,
} from "./types";

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toRecord(row: {
  id:                string;
  workspaceId:       string;
  scope:             string;
  scopeId:           string;
  autonomyMode:      string;
  allowedActionTypes: string;
  blockedActionTypes: string;
  approvalRequired:  string;
  constraints:       string;
  notes:             string | null;
  isActive:          boolean;
  createdAt:         Date;
  updatedAt:         Date;
}): ActionSafetyPolicyRecord {
  return {
    id:                  row.id,
    workspaceId:         row.workspaceId,
    scope:               row.scope as ActionSafetyScope,
    scopeId:             row.scopeId,
    autonomyMode:        row.autonomyMode as ActionSafetyPolicyRecord["autonomyMode"],
    allowedActionTypes:  parseJson<ActionType[]>(row.allowedActionTypes, []),
    blockedActionTypes:  parseJson<ActionType[]>(row.blockedActionTypes, []),
    approvalRequired:    parseJson<ActionType[]>(row.approvalRequired, []),
    constraints:         parseJson<ActionConstraint[]>(row.constraints, []),
    notes:               row.notes,
    isActive:            row.isActive,
    createdAt:           row.createdAt.toISOString(),
    updatedAt:           row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * Load all active policies relevant to an evaluation context.
 * Loads client, ad_account, and campaign policies in one query where applicable.
 */
export async function loadPoliciesForContext(
  context: PolicyEvaluationContext
): Promise<ActionSafetyPolicyRecord[]> {
  const orClauses: Array<{ scope: string; scopeId: string }> = [];

  if (context.clientId)    orClauses.push({ scope: "client",     scopeId: context.clientId });
  if (context.adAccountId) orClauses.push({ scope: "ad_account", scopeId: context.adAccountId });
  if (context.campaignId)  orClauses.push({ scope: "campaign",   scopeId: context.campaignId });

  if (orClauses.length === 0) return [];

  const rows = await prisma.actionSafetyPolicy.findMany({
    where: {
      workspaceId: context.workspaceId,
      isActive:    true,
      OR:          orClauses,
    },
  });

  return rows.map(toRecord);
}

/**
 * Load all active policies for a workspace (used by the policies UI page).
 */
export async function loadWorkspacePolicies(
  workspaceId: string
): Promise<ActionSafetyPolicyRecord[]> {
  const rows = await prisma.actionSafetyPolicy.findMany({
    where:   { workspaceId, isActive: true },
    orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toRecord);
}

/**
 * Load a single policy by (workspaceId, scope, scopeId).
 * Returns null if no active record exists.
 */
export async function loadScopePolicy(
  workspaceId: string,
  scope:       ActionSafetyScope,
  scopeId:     string
): Promise<ActionSafetyPolicyRecord | null> {
  const row = await prisma.actionSafetyPolicy.findUnique({
    where: {
      workspaceId_scope_scopeId: { workspaceId, scope, scopeId },
    },
  });
  return row ? toRecord(row) : null;
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/**
 * Upsert a policy record for a (workspaceId, scope, scopeId) triple.
 * Creates on first write; updates on subsequent writes.
 */
export async function upsertScopePolicy(
  input: UpsertPolicyInput
): Promise<ActionSafetyPolicyRecord> {
  const data = {
    workspaceId:        input.workspaceId,
    scope:              input.scope,
    scopeId:            input.scopeId,
    autonomyMode:       input.autonomyMode,
    allowedActionTypes: JSON.stringify(input.allowedActionTypes),
    blockedActionTypes: JSON.stringify(input.blockedActionTypes),
    approvalRequired:   JSON.stringify(input.approvalRequired),
    constraints:        JSON.stringify(input.constraints),
    notes:              input.notes ?? null,
    isActive:           true,
  };

  const row = await prisma.actionSafetyPolicy.upsert({
    where: {
      workspaceId_scope_scopeId: {
        workspaceId: input.workspaceId,
        scope:       input.scope,
        scopeId:     input.scopeId,
      },
    },
    create: data,
    update: {
      autonomyMode:       data.autonomyMode,
      allowedActionTypes: data.allowedActionTypes,
      blockedActionTypes: data.blockedActionTypes,
      approvalRequired:   data.approvalRequired,
      constraints:        data.constraints,
      notes:              data.notes,
      isActive:           true,
    },
  });

  return toRecord(row);
}

/**
 * Deactivate (soft-delete) a policy record.
 * The record is kept for audit history but excluded from evaluation.
 */
export async function deactivateScopePolicy(
  workspaceId: string,
  scope:       ActionSafetyScope,
  scopeId:     string
): Promise<void> {
  await prisma.actionSafetyPolicy.updateMany({
    where: {
      workspaceId,
      scope,
      scopeId,
      isActive: true,
    },
    data: { isActive: false },
  });
}
