import { utmPerformanceRows } from "../../lib/data/utmReporting";
import { ReportingView } from "./ReportingView";

export const metadata = {
  title: "UTM Reporting — Media Buying Dashboard"
};

export default function ReportingPage() {
  return <ReportingView rows={utmPerformanceRows} />;
}
