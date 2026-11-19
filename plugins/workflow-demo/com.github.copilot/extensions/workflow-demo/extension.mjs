import { defineWorkflow, joinSession } from "@github/copilot-sdk/extension";
import { workflowDefinition } from "./workflow.mjs";

await joinSession({
    workflows: [defineWorkflow(workflowDefinition)],
});
