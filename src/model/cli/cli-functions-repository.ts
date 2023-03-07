export class CliFunctionsRepository {
  private static targets: any[] = [];
  public static PushCliFunction(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
    key: string,
    description: string,
  ) {
    CliFunctionsRepository.targets.push({
      target,
      propertyKey,
      descriptor,
      key,
      description,
    });
  }

  public static GetCliFunctions(key: any) {
    const results = CliFunctionsRepository.targets.find((x) => x.key === key);
    if (results === undefined || results.length === 0) {
      throw new Error(`no CLI mode found for ${key}`);
    }

    return results;
  }

  public static GetAllCliModes() {
    return CliFunctionsRepository.targets.map((x) => {
      return {
        key: x.key,
        description: x.description,
      };
    });
  }

  // eslint-disable-next-line no-unused-vars
  public static PushCliFunctionSource(cliFunction: any) {}
}

export function CliFunction(key: string, description: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    CliFunctionsRepository.PushCliFunction(target, propertyKey, descriptor, key, description);
  };
}
