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
  return targets.find((x) => x.key === key);
}
export function GetAllCliModes() {
  return targets.map((x) => x.key);
}
