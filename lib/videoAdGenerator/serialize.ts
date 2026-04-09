// Video Ad Generator — serialization helpers
//
// Safe JSON parsing for stored concept fields. All generated sections are
// persisted as JSON strings; these helpers parse them back into typed
// objects and return null on any failure (missing, empty, or malformed).

import type {
  Angle,
  Hook,
  Script,
  ShotListItem,
  Cta,
  PlatformVariants,
} from "./types";

function safeParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export interface ConceptRecord {
  id:             string;
  title:          string;
  status:         string;
  platform:       string;
  adStyle:        string;
  productName:    string;
  offer:          string;
  audience:       string;
  painPoints:     string;
  awarenessStage: string;
  brandVoice:     string | null;
  extraNotes:     string | null;
  angle:          string | null;
  hooks:          string | null;
  script:         string | null;
  shotList:       string | null;
  ctas:           string | null;
  platformVariants: string | null;
  notes:          string | null;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface HydratedConcept {
  id:             string;
  title:          string;
  status:         string;
  platform:       string;
  adStyle:        string;
  productName:    string;
  offer:          string;
  audience:       string;
  painPoints:     string;
  awarenessStage: string;
  brandVoice:     string | null;
  extraNotes:     string | null;
  angle:          Angle | null;
  hooks:          Hook[] | null;
  script:         Script | null;
  shotList:       ShotListItem[] | null;
  ctas:           Cta[] | null;
  platformVariants: PlatformVariants | null;
  notes:          string | null;
  createdAt:      Date;
  updatedAt:      Date;
}

export function hydrateConcept(row: ConceptRecord): HydratedConcept {
  return {
    ...row,
    angle:            safeParse<Angle>(row.angle),
    hooks:            safeParse<Hook[]>(row.hooks),
    script:           safeParse<Script>(row.script),
    shotList:         safeParse<ShotListItem[]>(row.shotList),
    ctas:             safeParse<Cta[]>(row.ctas),
    platformVariants: safeParse<PlatformVariants>(row.platformVariants),
  };
}
