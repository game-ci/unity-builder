# Unity-Builder

GitHub Action and CLI that builds Unity projects for multiple platforms. Part of the [GameCI](https://game.ci) project.

## Quick Reference

```bash
yarn              # install dependencies
yarn build        # full build: tsc → ncc bundle (src/ → lib/ → dist/index.js)
yarn test         # run all tests (jest)
yarn test:ci      # run tests in CI mode (single-threaded, 2min timeout)
yarn lint         # prettier + eslint check
yarn format       # auto-format with prettier
```

## Architecture

**Entry point:** `src/index.ts` → decides between CLI mode and GitHub Action mode.

**Two execution paths:**
1. **Local builds** — Docker container or native macOS (`src/model/docker.ts`, `src/model/mac-builder.ts`)
2. **Orchestrator builds** — Remote execution on AWS ECS, Kubernetes, or other providers (`src/model/orchestrator/`)

**Key modules:**

| Path | Purpose |
|---|---|
| `src/model/build-parameters.ts` | Central config object — all build settings flow through here |
| `src/model/input.ts` | Input resolution with priority: Action inputs → CLI flags → env override → env vars |
| `src/model/orchestrator/orchestrator.ts` | Remote build orchestration — provider selection, workflow execution |
| `src/model/orchestrator/providers/` | Provider plugin system (AWS, K8s, Docker, Local, Test) |
| `src/model/orchestrator/remote-client/` | Code that runs inside remote containers (caching, hooks, artifacts) |
| `src/model/orchestrator/workflows/` | Build workflow types (standard, custom, async) |
| `src/model/orchestrator/services/` | Logging, locking, resource tracking |
| `src/model/cli/` | CLI mode using commander — dispatches to `@CliFunction`-decorated methods |
| `action.yml` | GitHub Action manifest — all inputs/outputs defined here |
| `dist/index.js` | Bundled output (committed to repo, used by action.yml at runtime) |

**Provider interface:** All providers implement `ProviderInterface` (`providers/provider-interface.ts`) with methods: `setupWorkflow`, `runTaskInWorkflow`, `cleanupWorkflow`, `garbageCollect`, `listResources`, `listWorkflow`, `watchWorkflow`.

**Provider loading:** Providers can be built-in, loaded from npm, cloned from GitHub repos, or loaded from local paths (`provider-loader.ts`).

## Build System

The build pipeline is: `yarn` → `tsc` (src/ → lib/) → `ncc build lib` (lib/ → dist/index.js).

- **dist/ is committed** — GitHub Actions loads `dist/index.js` directly, no install step on runners
- **Pre-commit hooks** (lefthook) auto-run formatting, linting, related tests, and `yarn build` to keep dist/ in sync
- Runtime: Node 20 (configured via Volta and action.yml `runs.using: node20`)

## Code Conventions

- **Files:** kebab-case (enforced by eslint `unicorn/filename-case`)
- **Code:** camelCase variables/functions, PascalCase classes/types
- **Formatting:** Prettier — 120 char width, single quotes, trailing commas, semicolons
- **Linting:** ESLint with unicorn, github, prettier, jest plugins
- **TypeScript:** strict mode, ES2020 target, CommonJS modules, experimental decorators enabled
- **Blank line before return statements** (enforced)
- **Blank line before block/line comments** (enforced)
- **No `for...in` loops** — use `for...of`

## Testing

- **Framework:** Jest 27 with ts-jest
- **Pattern:** `**/*.test.ts` files colocated with source
- **Orchestrator tests:** Concentrated in `src/model/orchestrator/tests/`
- **Run specific tests:** `yarn test -t "pattern"` or `yarn jest path/to/file.test.ts`
- **Orchestrator integration tests** require `orchestratorTests=true` env var: `cross-env orchestratorTests=true yarn test -i -t "orchestrator"`

## Security

- **Never log, output, or hardcode credentials** — cloud provider secrets (AWS, GCP, K8s), Unity serial keys, keystores, and private tokens must stay in secret inputs
- **Input validation matters** — user-supplied hook commands and custom parameters can be injection vectors; use `shell-quote` for shell escaping
- **Keystore/license data** is base64-encoded in inputs and written to temp files at build time

## CI Workflows

- `integrity-check.yml` — lint, test, build on every push/PR
- `build-tests-{ubuntu,windows,mac}.yml` — matrix builds across Unity versions and platforms
- `orchestrator-integrity.yml` / `orchestrator-async-checks.yml` — orchestrator-specific validation
