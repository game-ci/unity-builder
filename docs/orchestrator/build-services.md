# Orchestrator Build Services

Services that run during the build lifecycle to handle submodules, caching, LFS, and git hooks. These work with any provider (local, AWS, K8s, GCP, Azure, or custom CLI providers).

## Submodule Profiles

Selectively initialize submodules from a YAML profile instead of cloning everything. Useful for monorepos where builds only need a subset of submodules.

### Profile format

```yaml
primary_submodule: MyGameFramework
submodules:
  - name: CoreFramework
    branch: main          # initialize this submodule
  - name: OptionalModule
    branch: empty         # skip this submodule
  - name: Plugins*        # glob pattern — matches PluginsCore, PluginsAudio, etc.
    branch: main
```

- `branch: main` — initialize the submodule on its configured branch
- `branch: empty` — skip the submodule entirely (checked out to an empty branch)
- Glob patterns with trailing `*` match multiple submodules by prefix

### Variant overlays

A variant file merges on top of the base profile. Use variants for build-type or platform-specific overrides.

```yaml
# server-variant.yml — override for server builds
submodules:
  - name: ClientOnlyAssets
    branch: empty         # skip client assets for server builds
```

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `submoduleProfilePath` | — | Path to YAML submodule profile |
| `submoduleVariantPath` | — | Path to variant overlay (merged on top of profile) |
| `submoduleToken` | — | Auth token for private submodule clones |

### How it works

1. Parses the profile YAML and optional variant overlay
2. Reads `.gitmodules` to discover all submodules
3. Matches each submodule against profile entries (exact name or glob pattern)
4. Initializes matched submodules on the specified branch; skips the rest
5. If `submoduleToken` is set, configures `git config url."https://{token}@github.com/".insteadOf` for auth

---

## Local Build Caching

Filesystem-based caching of the Unity Library folder and LFS objects between local builds. No external cache actions required.

### How it works

- Cache key: `{platform}-{version}-{branch}` (sanitized)
- Cache root: `localCacheRoot` > `$RUNNER_TEMP/game-ci-cache` > `.game-ci/cache`
- On restore: extracts `library-{key}.tar` / `lfs-{key}.tar` if they exist
- On save: creates tar archives of the Library and LFS folders
- Garbage collection removes cache entries that haven't been accessed recently

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `localCacheEnabled` | `false` | Enable filesystem caching |
| `localCacheRoot` | — | Cache directory override |
| `localCacheLibrary` | `true` | Cache Unity Library folder |
| `localCacheLfs` | `true` | Cache LFS objects |

### Example

```yaml
- uses: game-ci/unity-builder@main
  with:
    providerStrategy: local
    localCacheEnabled: true
    localCacheRoot: /mnt/cache  # optional — persistent disk
    targetPlatform: StandaloneLinux64
```

---

## Custom LFS Transfer Agents

Register external Git LFS transfer agents (like [elastic-git-storage](https://github.com/frostebite/elastic-git-storage)) that handle LFS object storage via custom backends.

### How it works

Configures git to use a custom transfer agent via:
```
git config lfs.customtransfer.{name}.path <executable>
git config lfs.customtransfer.{name}.args <args>
git config lfs.standalonetransferagent {name}
```

The agent name is derived from the executable filename.

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `lfsTransferAgent` | — | Path to custom LFS agent executable |
| `lfsTransferAgentArgs` | — | Arguments passed to the agent |
| `lfsStoragePaths` | — | Sets `LFS_STORAGE_PATHS` environment variable |

### Example

```yaml
- uses: game-ci/unity-builder@main
  with:
    providerStrategy: local
    lfsTransferAgent: ./tools/elastic-git-storage
    lfsTransferAgentArgs: --config ./lfs-config.yml
    targetPlatform: StandaloneLinux64
```

---

## Git Hooks

Detect and install lefthook or husky during builds. Disabled by default for build performance.

### How it works

1. Detects hook framework: looks for `lefthook.yml` / `.lefthook.yml` (lefthook) or `.husky/` directory (husky)
2. If enabled, runs `npx lefthook install` or sets up husky
3. If disabled (default), sets `core.hooksPath` to an empty directory to bypass all hooks
4. Skip list: specific hooks can be skipped via environment variables (`LEFTHOOK_EXCLUDE` for lefthook, `HUSKY=0` for husky)

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `gitHooksEnabled` | `false` | Install and run git hooks during build |
| `gitHooksSkipList` | — | Comma-separated list of hooks to skip |

### Example

```yaml
# Enable hooks but skip pre-commit
- uses: game-ci/unity-builder@main
  with:
    providerStrategy: local
    gitHooksEnabled: true
    gitHooksSkipList: pre-commit,prepare-commit-msg
    targetPlatform: StandaloneLinux64
```

## Related

- [Provider Plugins](provider-plugins.md) — CLI provider protocol, dynamic loading, provider interface
- [Cloud Providers](cloud-providers.md) — GCP Cloud Run and Azure ACI configuration
