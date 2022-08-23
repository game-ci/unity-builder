export class Parameter {
  public static toUpperSnakeCase(input: string) {
    if (input.toUpperCase() === input) return input;

    return input.replace(/([\da-z])([A-Z])/g, '$1_$2').toUpperCase();
  }

  public static toCamelCase(input: string) {
    return input
      .split('_')
      .map((word) => `${word[0].toUppercase()}${word.slice(1).toLowerCase()}`)
      .join('');
  }
}
