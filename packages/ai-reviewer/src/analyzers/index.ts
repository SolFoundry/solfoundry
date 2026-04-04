import type { AnalyzerResult, ReviewContext } from "../types/review";
import { runPerformanceAnalyzer } from "./performance";
import { runQualityAnalyzer } from "./quality";
import { runSecurityAnalyzer } from "./security";

export function runHeuristicAnalyzers(context: ReviewContext): AnalyzerResult[] {
  return [
    runSecurityAnalyzer(context.changedFiles),
    runPerformanceAnalyzer(context.changedFiles),
    runQualityAnalyzer(context.changedFiles, context.repositoryConfig.customRules)
  ];
}
