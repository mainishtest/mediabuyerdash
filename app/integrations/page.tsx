import {
  availableMetaAccounts,
  crmConnections,
  utmAttributionRows,
  crmPerformanceMetrics,
  reconciliationRecords
} from "../../lib/data/integrations/index";
import { IntegrationsView } from "./IntegrationsView";

export const metadata = {
  title: "Integrations — Media Buying Dashboard"
};

export default function IntegrationsPage() {
  return (
    <IntegrationsView
      metaAccounts={availableMetaAccounts}
      crmConnections={crmConnections}
      utmRows={utmAttributionRows}
      crmMetrics={crmPerformanceMetrics}
      reconciliationRecords={reconciliationRecords}
    />
  );
}
