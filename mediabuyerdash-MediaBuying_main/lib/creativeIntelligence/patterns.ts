// Pattern Grouping
//
// Aggregates extracted signals by patternType + patternLabel.
// Pure function — no side effects, no I/O.

import type { CreativeSignal, CreativePatternType } from "../../types/creativeIntelligence";

export interface SignalGroup {
  patternType:  CreativePatternType;
  patternLabel: string;
  count:        number;
  signals:      CreativeSignal[];
}

export function groupSignalsByPattern(signals: CreativeSignal[]): SignalGroup[] {
  const map = new Map<string, SignalGroup>();
  for (const s of signals) {
    const key = `${s.patternType}:${s.patternLabel}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      existing.signals.push(s);
    } else {
      map.set(key, { patternType: s.patternType, patternLabel: s.patternLabel, count: 1, signals: [s] });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function getGroupsByType(groups: SignalGroup[], type: CreativePatternType): SignalGroup[] {
  return groups.filter((g) => g.patternType === type);
}
