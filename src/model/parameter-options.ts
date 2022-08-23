type ParameterOption<T> = {
  cli: boolean;
  env: boolean;
  cfg: boolean;
  defaultValue: T;
};

// Todo - use CLI lib to define this instead.
export class ParameterOptions {
  static get region(): ParameterOption<string | number> {
    return {
      cli: true,
      env: true,
      cfg: true,
      defaultValue: 'eu-west-2',
    };
  }
}
