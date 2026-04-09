// Neutral tag pill for displaying metadata (ad style, visual style, etc.)

interface TagPillProps {
  children: string;
}

export function TagPill({ children }: TagPillProps) {
  return (
    <span className="rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
      {children}
    </span>
  );
}
