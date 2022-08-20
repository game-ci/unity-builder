type EnvVariables = { [index: string]: string };

export class Environment implements EnvVariables {
  public readonly os: string;
  public readonly arch: string;

  constructor(env: Deno.env, envFile: EnvVariables) {
    // Make an immutable copy of the environment variables.
    for (const [key, value] of Object.entries(env.toObject())) {
      // Todo - check if this ever happens at all
      if (value === undefined) {
        // eslint-disable-next-line no-console
        console.error(`Environment variable ${key} is undefined.`);
      }

      this[key] = value;
    }

    // Override any env variables that are set in a .env file.
    for (const [key, value] of Object.entries(envFile)) {
      this[key] = value;
    }

    // Override specific variables.
    this.os = Deno.build.os;
    this.arch = Deno.build.arch;
  }

  public get(key: string): string | undefined {
    return this[key];
  }

  public getOS(): string {
    return this.os;
  }

  public getArch(): string {
    return this.arch;
  }
}
