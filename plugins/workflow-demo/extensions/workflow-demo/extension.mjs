import { defineWorkflow, joinSession } from "@microsoft/copilot-sdk/extension";
import { workflowDefinition } from "./workflow.mjs";

await joinSession({
    workflows: [defineWorkflow(workflowDefinition)],
});
