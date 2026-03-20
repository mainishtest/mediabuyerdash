import type { ReactNode } from "react";

// components/ui/PageContainer.tsx
// Standard responsive page wrapper.
// Provides consistent horizontal padding, max-width, and vertical rhythm
// across all primary pages. Import and wrap page content in this component.
//
// Usage:
//   <PageContainer>
//     <PageHeader title="Clients" />
//     ...
//   </PageContainer>
//
// Use narrow={true} for single-column form pages (onboarding, settings).

export function PageContainer({
  children,
  narrow = false,
  className = "",
}: {
  children:   ReactNode;
  narrow?:    boolean;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 ${
        narrow ? "max-w-2xl" : "max-w-5xl"
      } ${className}`}
    >
      {children}
    </div>
  );
}
