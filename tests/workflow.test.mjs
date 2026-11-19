import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { workflowDefinition } from "../plugins/workflow-demo/com.github.copilot/extensions/workflow-demo/workflow.mjs";

function createContext(agent) {
    const controller = new AbortController();
    const events = [];
    return {
        controller,
        events,
        ctx: {
            runId: "test-run",
            signal: controller.signal,
            phase: (title) => events.push({ phase: title }),
            log: (message) => events.push({ log: message }),
            agent,
        },
    };
}

test("reports phases and progress around one agent call and returns its greeting", async () => {
    let calls = 0;
    const { ctx, events } = createContext(async (prompt, options) => {
        calls++;
        assert.match(prompt, /without using tools/);
        assert.equal(options.label, "Greeting");
        assert.deepEqual(events.filter((event) => event.phase), [
            { phase: "Prepare" },
            { phase: "Ask agent" },
        ]);
        return "  Welcome to the sample! \n";
    });

    const result = await workflowDefinition.run(ctx);

    assert.equal(calls, 1);
    assert.deepEqual(
        events.filter((event) => event.phase).map((event) => event.phase),
        ["Prepare", "Ask agent", "Summarize"],
    );
    assert.deepEqual(result, {
        runId: "test-run",
        greeting: "Welcome to the sample!",
        summary: "Completed all three phases with one greeting subagent.",
    });
    const logs = events.filter((event) => event.log).map((event) => event.log);
    assert.match(logs[0], /test-run/);
    assert.ok(logs.includes("Greeting received: Welcome to the sample!"));
    assert.equal(logs.at(-1), result.summary);
});

test("fails explicitly for a missing or blank subagent result", async (t) => {
    for (const response of [null, " \n"]) {
        await t.test(JSON.stringify(response), async () => {
            const { ctx, events } = createContext(async () => response);

            await assert.rejects(workflowDefinition.run(ctx), /subagent returned no usable text/);
            assert.equal(events.some((event) => event.phase === "Summarize"), false);
            assert.equal(events.some((event) => event.log?.startsWith("Completed")), false);
        });
    }
});

test("cancellation during the prepare delay prevents agent execution and completion", async () => {
    let calls = 0;
    const { ctx, controller, events } = createContext(async () => {
        calls++;
        return "Welcome!";
    });

    const run = workflowDefinition.run(ctx);
    controller.abort();

    await assert.rejects(run, { name: "AbortError" });
    assert.equal(calls, 0);
    assert.deepEqual(events.filter((event) => event.phase), [{ phase: "Prepare" }]);
    assert.equal(events.some((event) => event.log?.startsWith("Completed")), false);
});

test("cancellation during the summary delay does not report completion", async () => {
    const { ctx, controller, events } = createContext(async () => "Welcome!");
    const log = ctx.log;
    ctx.log = (message) => {
        log(message);
        if (message === "Preparing the final result.") {
            queueMicrotask(() => controller.abort());
        }
    };

    await assert.rejects(workflowDefinition.run(ctx), { name: "AbortError" });
    assert.equal(events.some((event) => event.log?.startsWith("Completed")), false);
});

test("a runtime failure from the agent is not hidden", async () => {
    const failure = new Error("Model service unavailable");
    const { ctx, events } = createContext(async () => {
        throw failure;
    });

    await assert.rejects(workflowDefinition.run(ctx), (error) => error === failure);
    assert.equal(events.some((event) => event.phase === "Summarize"), false);
});

test("the marketplace and plugin resolve to an extension entrypoint", async () => {
    const root = new URL("../", import.meta.url);
    const catalog = JSON.parse(await readFile(new URL(".github/plugin/marketplace.json", root), "utf8"));
    const entry = catalog.plugins[0];
    const pluginRoot = new URL(`${entry.source}/`, root);
    const manifest = JSON.parse(await readFile(new URL("plugin.json", pluginRoot), "utf8"));

    assert.equal(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    assert.equal(manifest.name, entry.name);
    assert.equal(manifest.version, entry.version);
    const extension = new URL("com.github.copilot/extensions/workflow-demo/extension.mjs", pluginRoot);
    assert.match(await readFile(extension, "utf8"), /joinSession/);
});
