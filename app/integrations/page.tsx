import {
  crmConnections,
  utmAttributionRows,
  reconciliationRecords
} from "../../lib/data/integrations/index";
import {
  mockMetaSession,
  mockAccessibleAccounts,
  mockInitialSelectedIds,
  mockSyncStatuses
} from "../../lib/data/metaConnection";
import { IntegrationsView } from "./IntegrationsView";

export const metadata = {
  title: "Integrations — Media Buying Dashboard"
};

export default function IntegrationsPage() {
  return (
    <IntegrationsView
      metaSession={mockMetaSession}
      accessibleAccounts={mockAccessibleAccounts}
      initialSelectedIds={mockInitialSelectedIds}
      syncStatuses={mockSyncStatuses}
      crmConnections={crmConnections}
      utmRows={utmAttributionRows}
      reconciliationRecords={reconciliationRecords}
    />
  );
}
