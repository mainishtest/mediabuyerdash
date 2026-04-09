const PLATFORM_STYLES: Record<string, string> = {
  facebook: "border-sky-700 bg-sky-900/30 text-sky-300",
  rumble:   "border-orange-700 bg-orange-900/30 text-orange-300",
  both:     "border-purple-700 bg-purple-900/30 text-purple-300",
};

const PLATFORM_NAMES: Record<string, string> = {
  facebook: "Facebook",
  rumble:   "Rumble",
  both:     "FB + Rumble",
};

interface PlatformBadgeProps {
  platform: string;
  size?: "sm" | "md";
}

export function PlatformBadge({ platform, size = "sm" }: PlatformBadgeProps) {
  const style = PLATFORM_STYLES[platform] ?? PLATFORM_STYLES.facebook;
  const text = size === "sm" ? "text-[10px]" : "text-xs";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${text} font-semibold uppercase tracking-wider ${style}`}>
      {PLATFORM_NAMES[platform] ?? platform}
    </span>
  );
}
