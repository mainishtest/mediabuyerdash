import { sampleOptimizationRules } from "../../lib/rules/sampleRules";
import { sampleRuleContexts }      from "../../lib/rules/sampleRuleContexts";
import { evaluateRuleSet }         from "../../lib/rules/ruleEngine";
import { OptimizationLabView }     from "./OptimizationLabView";

export const metadata = {
  title: "Optimization Lab — Media Buying Dashboard"
};

export default function OptimizationLabPage() {
  const { results, recommendations } = evaluateRuleSet(
    sampleOptimizationRules,
    sampleRuleContexts
  );

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-200 sm:px-6 lg:px-8">
      <OptimizationLabView
        rules={sampleOptimizationRules}
        contexts={sampleRuleContexts}
        results={results}
        recommendations={recommendations}
      />
    </div>
  );
}
