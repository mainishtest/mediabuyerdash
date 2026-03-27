// lib/creativeOutcomeRouting/index.ts
// Public API for the winner-loser routing and learning feedback layer.

export { buildCreativeOutcomeRoute } from "./router";
export { extractCreativeIterationLearning, buildCreativeIterationFeedback } from "./learnings";
export {
  saveCreativeOutcomeRoute,
  updateCreativeOutcomeRouteState,
  loadCreativeOutcomeRouteById,
  loadCreativeOutcomeRouteByTestResultId,
  loadCreativeOutcomeRoutes,
  buildCreativeOutcomeRoutingSummary,
} from "./db";
