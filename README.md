# Dynamic workflow plugin sample

A minimal Copilot plugin that registers **`workflow-demo`**, a dynamic workflow with three visible phases, progress messages, one greeting subagent, and a final JSON result.

The sample uses Copilot's native workflow tracking, not a custom UI. It is not a GitHub Actions workflow.

## How it works

```text
.github\plugin\marketplace.json                       Marketplace catalog
plugins\workflow-demo\plugin.json                     Plugin manifest
plugins\workflow-demo\extensions\workflow-demo\
    extension.mjs                                    SDK registration
    workflow.mjs                                     Workflow definition
tests\workflow.test.mjs                               Model-free tests
```

The marketplace points to the plugin. The plugin's `extensions` field points to a directory of extensions. Copilot loads `extension.mjs`, which uses the host-provided `@github/copilot-sdk/extension` API:

```js
await joinSession({
    workflows: [defineWorkflow(workflowDefinition)],
});
```

**Why `@github/copilot-sdk`?** Newer CLI builds also provide the SDK as `@microsoft/copilot-sdk`, but some Copilot app builds only provide `@github/copilot-sdk`. Importing from `@github/copilot-sdk/extension` works in both.

`workflow.mjs` declares the phases and implements the workflow body:

| Phase | Work |
| --- | --- |
| Prepare | Log the run ID and wait 1.5 seconds so the phase is visible. |
| Ask agent | Call `ctx.agent` once, labeled **Greeting**, to request a short welcome sentence. |
| Summarize | Log summary preparation, wait 1.5 seconds, and return a JSON result. |

`ctx.phase` updates the current phase; `ctx.log` adds progress messages. Both waits use `ctx.signal` so cancellation interrupts them. Missing or blank agent output fails the workflow explicitly. Other runtime errors propagate instead of being reported as success.

The subagent inherits the host's model choice. It is asked not to use tools, inspect files, or delegate. The sample itself performs no file writes or external API calls; the model request uses normal Copilot usage/AI credits, and Copilot records its usual session history. No custom credentials are required.

**Why a legacy manifest?** This sample deliberately omits the Agent Plugins `$schema`: the legacy Copilot format documents an `extensions` path field for executable extensions. Agent Plugins 1.0 uses the same field name for a different, namespaced metadata map. Do not add that schema while retaining this path field.

## Prerequisites

- A current Copilot CLI, or the GitHub Copilot app for the app walkthrough.
- A signed-in account eligible to run dynamic workflows. See the [availability and billing requirements][workflows-concept]; an installed plugin alone does not establish eligibility.
- Experimental features enabled in CLI (`copilot --experimental` or `/settings experimental on`), with extensions not disabled.
- Remote installation and the app/cloud walkthroughs use the public repository [`mjrousos/dynamic-workflow-plugin-sample`][repo]. If you fork it, replace `mjrousos/dynamic-workflow-plugin-sample` in the commands below with your fork.

Dynamic workflows and extensions are preview/experimental features, so client support and commands can change.

## Test in Copilot CLI

Run these PowerShell commands from this repository's root.

### Develop without installing

Mount the plugin for one CLI invocation; this does not add it to your installed plugins:

```powershell
copilot --plugin-dir .\plugins\workflow-demo plugin list
copilot --experimental --plugin-dir .\plugins\workflow-demo
```

Trust the folder if prompted. In the interactive session, ask:

```text
What dynamic workflows are available?
Run the workflow-demo dynamic workflow.
```

Approve the run if prompted. Enter **`/workflows`**, select the run, and inspect its current phase, progress, **Greeting** subagent, and usage. Native controls allow pausing or canceling an active run. The two fixed waits are intentionally short; completed runs also retain their details.

To run directly from the terminal instead:

```powershell
copilot --experimental --plugin-dir .\plugins\workflow-demo workflow run workflow-demo
```

No arguments are needed. This command waits for completion. It cannot display tool-permission approval prompts; this sample needs no tool grants and should not require `--allow-all`.

Representative progress (exact CLI formatting and greeting vary):

```text
Prepare
Starting workflow-demo run <run-id>.
Ask agent
Requesting a greeting from one subagent.
Greeting received: Welcome to the Copilot dynamic workflow sample!
Summarize
Preparing the final result.
Completed all three phases with one greeting subagent.
```

The result has this shape:

```json
{
  "runId": "<run-id>",
  "greeting": "Welcome to the Copilot dynamic workflow sample!",
  "summary": "Completed all three phases with one greeting subagent."
}
```

For machine-readable events, add `--output-format json` (JSONL). For the returned value alone, use `--result-file`:

```powershell
copilot --experimental --plugin-dir .\plugins\workflow-demo workflow run workflow-demo --output-format json
copilot --experimental --plugin-dir .\plugins\workflow-demo workflow run workflow-demo --result-file .\workflow-result.json
```

Each command starts a **new run** and incurs model usage. The result file is written only on successful completion; delete it after testing if not needed.

### Install the plugin

For a cached local installation:

```powershell
copilot plugin install .\plugins\workflow-demo
copilot plugin list
copilot --experimental
```

Use the same discovery/run prompts and `/workflows` controls above. After editing a locally installed plugin, install it again and start a new session to refresh the cached copy. A `--plugin-dir` mount instead reads your development files on the next invocation.

To install from GitHub without cloning, install the plugin directly:

```powershell
copilot plugin install mjrousos/dynamic-workflow-plugin-sample:plugins/workflow-demo
```

Or register its marketplace and install by name:

```powershell
copilot plugin marketplace add mjrousos/dynamic-workflow-plugin-sample
copilot plugin marketplace browse dynamic-workflow-samples
copilot plugin install workflow-demo@dynamic-workflow-samples
```

The marketplace name is **`dynamic-workflow-samples`**, regardless of the repository's name. Choose one installation method rather than installing duplicate copies. Remove an installed copy with `copilot plugin uninstall workflow-demo` when finished.

## Install and test in the Copilot app

These steps use the GitHub-hosted marketplace, not the CLI-only local mount.

1. Open **Customize** in the app sidebar. Use the marketplace settings control next to the marketplace dropdown to add `mjrousos/dynamic-workflow-plugin-sample` (or `https://github.com/mjrousos/dynamic-workflow-plugin-sample.git`).
2. Browse/search for **workflow-demo**, click **Install**, and confirm it is enabled under **Installed**.
3. Start a new **local session** in a repository or folder. Ask what dynamic workflows are available, then explicitly ask: `Run the workflow-demo dynamic workflow.`
4. Open the **Workflows** button above the prompt box while the run is active, or after it completes. Select the run to inspect its phases, progress messages, subagent, and usage. Check for completion and the greeting result.

The documented app workflow-monitoring UI is **local-session-only**. Do not assume it applies to app sessions delegated to the cloud. No canvas is required for this sample.

## Configure and verify in a repository using Copilot cloud agent

To configure the plugin using the [documented cloud-agent mechanism][cloud-settings]:

1. In the **consuming repository**, add the following to `.github\copilot\settings.json`, merging with existing settings rather than overwriting them. (If you use a fork, point `repo` at it.)
2. Commit the settings and make them available on the branch used for a new cloud-agent task.

```json
{
  "extraKnownMarketplaces": {
    "dynamic-workflow-samples": {
      "source": {
        "source": "github",
        "repo": "mjrousos/dynamic-workflow-plugin-sample"
      }
    }
  },
  "enabledPlugins": {
    "workflow-demo@dynamic-workflow-samples": true
  }
}
```

Cloud agent uses these repository settings without a local override. Organizational policy and repository access still apply. This sample repository does not enable the plugin for itself; add the settings to the repository where you want cloud agent to use it.

Start a new cloud-agent task in the consuming repository with this verification prompt:

```text
Verify the workflow-demo plugin configured in this repository.
Report whether its extension loaded and whether the workflow-demo dynamic
workflow is registered. Run the workflow once and report its run ID, terminal status,
reported phases, and greeting result.
```

Inspect the cloud-agent session output/logs for the actual result. 

## Model-free checks

From the repository root:

```powershell
node --check .\plugins\workflow-demo\extensions\workflow-demo\extension.mjs
node --check .\plugins\workflow-demo\extensions\workflow-demo\workflow.mjs
node --test .\tests\workflow.test.mjs
```

Tests execute the real workflow body with a fake context and stubbed agent, covering ordered phases, logs/results, null/blank agent output, propagated model-service failure, cancellation, and manifest path resolution. The fixed waits remain real, so the suite does not finish instantly. These checks do not prove SDK loading or model access; the CLI smoke test does.

| Check | Validation status |
| --- | --- |
| Syntax and model-free tests | Passed: eight tests using Node.js 26.13.0. |
| Local plugin discovery and real CLI run | Passed with CLI 1.0.114-0: extension loaded, three phases reported, one subagent completed with zero tool calls, JSON result returned. |
| GitHub marketplace installation (CLI) | Passed with CLI 1.0.114-0: `marketplace add`, `browse`, and `install workflow-demo@dynamic-workflow-samples` succeeded in a fresh `COPILOT_HOME`; `workflow run workflow-demo` completed all three phases and returned a result. |
| App installation and local run | Documented manual verification; not executed here. |
| Cloud-agent plugin configuration/execution | Documented configuration and verification procedure; execution support remains unverified. |

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Workflow not found | Confirm the plugin is enabled with `copilot plugin list`; use a new session after installing. In CLI, enable experimental features and use `/extensions` to check extension status and `/extensions mode` if loading is disabled. |
| Extension fails to load | Inspect the extension diagnostics/log path from `/extensions`. Keep the manifest's `extensions` field and directory layout intact. The SDK import resolves inside Copilot, not with `node extension.mjs` alone. |
| Edits do not appear | Reinstall a cached local plugin and start a new session, or use `--plugin-dir` for development. Run `copilot plugin update workflow-demo` to pick up pushed changes in a remotely installed plugin. |
| Run cannot start | Check dynamic-workflow eligibility, authentication, and managed policy. A successfully installed plugin does not override them. |
| No usable greeting | The run deliberately fails for an empty/failed subagent response. Inspect the run's error and model-service availability; do not treat it as completed. |
| No app Workflows button | First invoke the workflow in a local session; the documented monitoring UI is not available for cloud sessions. |

## References

- [Dynamic workflows: concepts and availability][workflows-concept]
- [Using, monitoring, and distributing dynamic workflows][workflows-usage]
- [Creating Copilot CLI plugins][plugin-authoring]
- [Plugin manifest and extension path reference][plugin-reference]
- [Creating and sharing a marketplace][marketplaces]
- [Customizing the Copilot app][app-customization]
- [Configuring plugins for Copilot cloud agent][cloud-settings]

[repo]: https://github.com/mjrousos/dynamic-workflow-plugin-sample
[workflows-concept]: https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/dynamic-workflows
[workflows-usage]: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-dynamic-workflows
[plugin-authoring]: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating
[plugin-reference]: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
[marketplaces]: https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/create-and-share-plugin-marketplaces
[app-customization]: https://docs.github.com/en/copilot/how-tos/github-copilot-app/customize-github-copilot-app
[cloud-settings]: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/configuring-agent-settings
