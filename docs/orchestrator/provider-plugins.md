# Orchestrator Provider Plugins

The orchestrator supports multiple **providers** that control where and how Unity builds execute. Providers are selected via the `providerStrategy` input.

## Built-in Providers

| Provider | Input value | Description |
|----------|------------|-------------|
| AWS (ECS + Fargate) | `aws` | Runs builds on AWS using CloudFormation, ECS, and S3 |
| Kubernetes | `k8s` | Runs builds as Kubernetes Jobs with persistent volume claims |
| Local (system) | `local` / `local-system` | Runs builds directly on the runner's OS |
| Local (Docker) | `local-docker` | Runs builds in a Docker container on the runner |
| Test | `test` | Mock provider for automated testing |
| GCP Cloud Run | `gcp-cloud-run` | **(Experimental)** Runs builds as Cloud Run Jobs |
| Azure ACI | `azure-aci` | **(Experimental)** Runs builds as Azure Container Instances |

## CLI Provider Protocol

Any executable that speaks the CLI provider protocol can act as a provider. This lets you write providers in Go, Python, Rust, shell, or any language — no TypeScript required.

Set `providerExecutable` to the path of your executable. The orchestrator will invoke it instead of a built-in provider.

### Protocol

```
Invocation:  <executable> <subcommand>
Input:       JSON on stdin
Output:      JSON on stdout
Errors:      stderr forwarded to orchestrator logs
```

### Subcommands

| Subcommand | Purpose |
|------------|---------|
| `setup-workflow` | Initialize infrastructure before a build |
| `run-task` | Execute the build (streaming — non-JSON stdout lines are real-time output) |
| `cleanup-workflow` | Tear down infrastructure after a build |
| `garbage-collect` | Remove old resources |
| `list-resources` | List active resources |
| `list-workflow` | List active workflows |
| `watch-workflow` | Watch a workflow until completion |

### Request format

```json
{
  "command": "run-task",
  "params": {
    "buildGuid": "abc-123",
    "image": "unityci/editor:2022.3.0f1-linux-il2cpp-3",
    "commands": "/bin/sh -c 'unity-editor -batchmode ...'",
    "mountdir": "/workspace",
    "workingdir": "/workspace",
    "environment": [{ "name": "UNITY_LICENSE", "value": "..." }],
    "secrets": []
  }
}
```

### Response format

```json
{
  "success": true,
  "result": "Build completed successfully"
}
```

Error response:

```json
{
  "success": false,
  "error": "Container exited with code 1"
}
```

### Streaming output

During `run-task` and `watch-workflow`, non-JSON lines on stdout are treated as real-time build output and forwarded to the orchestrator logs. Only the final JSON line is parsed as the response. This means your provider can freely print build logs to stdout.

### Timeouts

- `run-task` and `watch-workflow`: no timeout (builds can run for hours)
- All other subcommands: 300 seconds

### Example: minimal provider in shell

```bash
#!/bin/bash
case "$1" in
  setup-workflow)
    read request
    echo '{"success": true, "result": "ready"}'
    ;;
  run-task)
    read request
    image=$(echo "$request" | jq -r '.params.image')
    commands=$(echo "$request" | jq -r '.params.commands')
    docker run --rm "$image" /bin/sh -c "$commands"
    echo '{"success": true, "result": "done"}'
    ;;
  cleanup-workflow)
    read request
    echo '{"success": true, "result": "cleaned"}'
    ;;
  *)
    echo '{"success": false, "error": "Unknown command: '"$1"'"}'
    exit 1
    ;;
esac
```

### Action input

```yaml
- uses: game-ci/unity-builder@main
  with:
    providerStrategy: local  # or any value; CLI provider takes precedence
    providerExecutable: ./my-provider
```

## Dynamic Provider Loading

Providers can also be loaded dynamically from GitHub repositories, NPM packages, or local paths. The provider must export a class that implements `ProviderInterface` with all 7 methods.

```yaml
# From GitHub
providerStrategy: https://github.com/my-org/my-provider

# From local path
providerStrategy: ./custom-providers/my-provider

# From NPM
providerStrategy: my-provider-package
```

## Provider Interface

All providers (built-in, CLI, or dynamic) implement the same 7-method interface:

```typescript
interface ProviderInterface {
  setupWorkflow(buildGuid, buildParameters, branchName, secrets): any;
  runTaskInWorkflow(buildGuid, image, commands, mountdir, workingdir, environment, secrets): Promise<string>;
  cleanupWorkflow(buildParameters, branchName, secrets): any;
  garbageCollect(filter, previewOnly, olderThan, fullCache, baseDependencies): Promise<string>;
  listResources(): Promise<ProviderResource[]>;
  listWorkflow(): Promise<ProviderWorkflow[]>;
  watchWorkflow(): Promise<string>;
}
```

## Related

- [Cloud Providers](cloud-providers.md) — GCP Cloud Run and Azure ACI configuration
- [Build Services](build-services.md) — Submodule profiles, local caching, LFS agents, git hooks
