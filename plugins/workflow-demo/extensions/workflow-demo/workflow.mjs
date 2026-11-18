import { setTimeout } from "node:timers/promises";

export const workflowDefinition = {
    meta: {
        name: "workflow-demo",
        description: "A three-phase progress demo that asks one subagent for a greeting. No arguments required.",
        phases: [
            { title: "Prepare", detail: "Prepare a greeting request." },
            { title: "Ask agent", detail: "Ask one subagent for a short greeting." },
            { title: "Summarize", detail: "Return the greeting and completion summary." },
        ],
    },
    run: async (ctx) => {
        ctx.phase("Prepare");
        ctx.log(`Starting workflow-demo run ${ctx.runId}.`);
        await setTimeout(1500, undefined, { signal: ctx.signal });

        ctx.phase("Ask agent");
        ctx.log("Requesting a greeting from one subagent.");
        const greeting = await ctx.agent(
            "Write one short, friendly sentence welcoming someone to this Copilot dynamic workflow sample. " +
                "Answer directly without using tools, inspecting files, or delegating to other agents.",
            { label: "Greeting" },
        );
        if (typeof greeting !== "string" || greeting.trim().length === 0) {
            throw new Error("The greeting subagent returned no usable text.");
        }
        ctx.signal.throwIfAborted();
        ctx.log(`Greeting received: ${greeting.trim()}`);

        ctx.phase("Summarize");
        ctx.log("Preparing the final result.");
        await setTimeout(1500, undefined, { signal: ctx.signal });

        const result = {
            runId: ctx.runId,
            greeting: greeting.trim(),
            summary: "Completed all three phases with one greeting subagent.",
        };
        ctx.log(result.summary);
        return result;
    },
};
