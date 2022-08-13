type EnvVariables = { [index: string]: string };

export class Environment implements EnvVariables {
  public readonly os: string;
  public readonly arch: string;

  constructor(env: Deno.env) {
    // Make an immutable copy of the environment variables.
    for (const [key, value] of Object.entries(env.toObject())) {
      if (value !== undefined) this[key] = value;
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
