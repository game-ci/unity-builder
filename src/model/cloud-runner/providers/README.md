# Provider Loader Dynamic Imports

The provider loader now supports dynamic loading of providers from multiple sources including local file paths, GitHub repositories, and NPM packages.

## Features

- **Local File Paths**: Load providers from relative or absolute file paths
- **GitHub URLs**: Clone and load providers from GitHub repositories with automatic updates
- **NPM Packages**: Load providers from installed NPM packages
- **Automatic Updates**: GitHub repositories are automatically updated when changes are available
- **Caching**: Local caching of cloned repositories for improved performance
- **Fallback Support**: Graceful fallback to local provider if loading fails

## Usage Examples

### Loading Built-in Providers

```typescript
import { ProviderLoader } from './provider-loader';

// Load built-in providers
const awsProvider = await ProviderLoader.loadProvider('aws', buildParameters);
const k8sProvider = await ProviderLoader.loadProvider('k8s', buildParameters);
```

### Loading Local Providers

```typescript
// Load from relative path
const localProvider = await ProviderLoader.loadProvider('./my-local-provider', buildParameters);

// Load from absolute path
const absoluteProvider = await ProviderLoader.loadProvider('/path/to/provider', buildParameters);
```

### Loading GitHub Providers

```typescript
// Load from GitHub URL
const githubProvider = await ProviderLoader.loadProvider(
  'https://github.com/user/my-provider', 
  buildParameters
);

// Load from specific branch
const branchProvider = await ProviderLoader.loadProvider(
  'https://github.com/user/my-provider/tree/develop', 
  buildParameters
);

// Load from specific path in repository
const pathProvider = await ProviderLoader.loadProvider(
  'https://github.com/user/my-provider/tree/main/src/providers', 
  buildParameters
);

// Shorthand notation
const shorthandProvider = await ProviderLoader.loadProvider('user/repo', buildParameters);
const branchShorthand = await ProviderLoader.loadProvider('user/repo@develop', buildParameters);
```

### Loading NPM Packages

```typescript
// Load from NPM package
const npmProvider = await ProviderLoader.loadProvider('my-provider-package', buildParameters);

// Load from scoped NPM package
const scopedProvider = await ProviderLoader.loadProvider('@scope/my-provider', buildParameters);
```

## Provider Interface

All providers must implement the `ProviderInterface`:

```typescript
interface ProviderInterface {
  cleanupWorkflow(): Promise<void>;
  setupWorkflow(buildGuid: string, buildParameters: BuildParameters, branchName: string, defaultSecretsArray: any[]): Promise<void>;
  runTaskInWorkflow(buildGuid: string, task: string, workingDirectory: string, buildVolumeFolder: string, environmentVariables: any[], secrets: any[]): Promise<string>;
  garbageCollect(): Promise<void>;
  listResources(): Promise<ProviderResource[]>;
  listWorkflow(): Promise<ProviderWorkflow[]>;
  watchWorkflow(): Promise<void>;
}
```

## Example Provider Implementation

```typescript
// my-provider.ts
import { ProviderInterface } from './provider-interface';
import BuildParameters from './build-parameters';

export default class MyProvider implements ProviderInterface {
  constructor(private buildParameters: BuildParameters) {}

  async cleanupWorkflow(): Promise<void> {
    // Cleanup logic
  }

  async setupWorkflow(buildGuid: string, buildParameters: BuildParameters, branchName: string, defaultSecretsArray: any[]): Promise<void> {
    // Setup logic
  }

  async runTaskInWorkflow(buildGuid: string, task: string, workingDirectory: string, buildVolumeFolder: string, environmentVariables: any[], secrets: any[]): Promise<string> {
    // Task execution logic
    return 'Task completed';
  }

  async garbageCollect(): Promise<void> {
    // Garbage collection logic
  }

  async listResources(): Promise<ProviderResource[]> {
    return [];
  }

  async listWorkflow(): Promise<ProviderWorkflow[]> {
    return [];
  }

  async watchWorkflow(): Promise<void> {
    // Watch logic
  }
}
```

## Utility Methods

### Analyze Provider Source

```typescript
// Analyze a provider source without loading it
const sourceInfo = ProviderLoader.analyzeProviderSource('https://github.com/user/repo');
console.log(sourceInfo.type); // 'github'
console.log(sourceInfo.owner); // 'user'
console.log(sourceInfo.repo); // 'repo'
```

### Clean Up Cache

```typescript
// Clean up old cached repositories (older than 30 days)
await ProviderLoader.cleanupCache();

// Clean up repositories older than 7 days
await ProviderLoader.cleanupCache(7);
```

### Get Available Providers

```typescript
// Get list of built-in providers
const providers = ProviderLoader.getAvailableProviders();
console.log(providers); // ['aws', 'k8s', 'test', 'local-docker', 'local-system', 'local']
```

## Supported URL Formats

### GitHub URLs
- `https://github.com/user/repo`
- `https://github.com/user/repo.git`
- `https://github.com/user/repo/tree/branch`
- `https://github.com/user/repo/tree/branch/path/to/provider`
- `git@github.com:user/repo.git`

### Shorthand GitHub References
- `user/repo`
- `user/repo@branch`
- `user/repo@branch/path/to/provider`

### Local Paths
- `./relative/path`
- `../relative/path`
- `/absolute/path`
- `C:\\path\\to\\provider` (Windows)

### NPM Packages
- `package-name`
- `@scope/package-name`

## Caching

GitHub repositories are automatically cached in the `.provider-cache` directory. The cache key is generated based on the repository owner, name, and branch. This ensures that:

1. Repositories are only cloned once
2. Updates are checked and applied automatically
3. Performance is improved for repeated loads
4. Storage is managed efficiently

## Error Handling

The provider loader includes comprehensive error handling:

- **Missing packages**: Clear error messages when providers cannot be found
- **Interface validation**: Ensures providers implement the required interface
- **Git operations**: Handles network issues and repository access problems
- **Fallback mechanism**: Falls back to local provider if loading fails

## Configuration

The provider loader can be configured through environment variables:

- `PROVIDER_CACHE_DIR`: Custom cache directory (default: `.provider-cache`)
- `GIT_TIMEOUT`: Git operation timeout in milliseconds (default: 30000)

## Best Practices

1. **Use specific branches**: Always specify the branch when loading from GitHub
2. **Implement proper error handling**: Wrap provider loading in try-catch blocks
3. **Clean up regularly**: Use the cleanup utility to manage cache size
4. **Test locally first**: Test providers locally before deploying
5. **Use semantic versioning**: Tag your provider repositories for stable versions
