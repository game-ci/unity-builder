const targets = new Array();
export function CliFunction(key: string, description: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    targets.push({
      target,
      propertyKey,
      descriptor,
      key,
      description,
    });
  };
}
export function GetCliFunctions(key) {
  const results = targets.find((x) => x.key === key);
  if (results === undefined || results.length === 0) {
    throw new Error('no CLI mode found');
  }
  return results;
}
export function GetAllCliModes() {
  return targets.map((x) => {
    return {
      key: x.key,
      description: x.description,
    };
  });
}
