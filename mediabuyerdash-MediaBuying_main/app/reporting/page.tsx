export const dynamic = "force-dynamic";

// app/reporting/page.tsx
// UTM Reporting — placeholder until UTM data is sourced from reconciled matches.
// Previously used hardcoded mock rows from lib/data/utmReporting.

import { PageHeader, SectionCard, EmptyState } from "../../components/ui";

export const metadata = {
  title: "UTM Reporting — Media Buying Dashboard",
};

export default function ReportingPage() {
  return (
    <div className="space-y-0">
      <PageHeader
        title="UTM Reporting"
        description="Attribution and UTM campaign performance."
      />
      <SectionCard>
        <EmptyState
          icon="◎"
          title="UTM reporting coming soon"
          description="UTM attribution data will appear here once your Shopify and Meta integrations are connected and reconciliation has run. Navigate to a client's Campaigns page to view CRM-verified performance."
        />
      </SectionCard>
    </div>
  );
}
