/**
 * Replicates the original action's projectPath auto-detection: when
 * projectPath isn't given explicitly, and a test-project/ directory looks
 * like a Unity project while the current directory doesn't, default to
 * "test-project" instead of the repo root. See the original
 * Input.projectPath getter this is ported from.
 */
export interface ResolveProjectPathOptions {
  input: string;
  existsSync(path: string): boolean;
  joinPath(...segments: string[]): string;
}

export function resolveProjectPath({
  input,
  existsSync,
  joinPath,
}: ResolveProjectPathOptions): string {
  if (input) return input.replace(/\/$/, '');

  const hasTestProject = existsSync(
    joinPath('test-project', 'ProjectSettings', 'ProjectVersion.txt'),
  );
  const hasRootProject = existsSync(joinPath('ProjectSettings', 'ProjectVersion.txt'));

  if (hasTestProject && !hasRootProject) return 'test-project';

  return '';
}
