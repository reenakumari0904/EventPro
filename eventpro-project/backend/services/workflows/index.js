// Single import point that registers every workflow definition with the
// engine (services/workflows/engine.js). Importing this module (once, from
// server.js) is what makes `startWorkflow("speaker-cancellation", ...)`
// resolve — each workflow file calls defineWorkflow() as a side effect of
// being imported.
import "./speakerCancellation.js";
import "./sponsorPerformance.js";
import "./venueIssue.js";
import "./highCrowd.js";
