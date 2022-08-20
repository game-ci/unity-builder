/* eslint-disable unicorn/no-array-reduce,unicorn/explicit-length-check,padding-line-between-statements,github/array-foreach,unicorn/no-array-for-each */

// Source: https://github.com/tamino-martinius/node-ts-dedent/blob/master/src/index.ts
export function dedent(template: TemplateStringsArray | string, ...values: unknown[]): string {
  let strings = Array.from(typeof template === 'string' ? [template] : template);

  // 1. Remove trailing whitespace.
  strings[strings.length - 1] = strings[strings.length - 1].replace(/\r?\n([\t ]*)$/, '');

  // 2. Find all line breaks to determine the highest common indentation level.
  const indentLengths = strings.reduce((arr, str) => {
    const matches = str.match(/\n([\t ]+|(?!\s).)/g);
    if (matches) {
      return arr.concat(matches.map((match) => match.match(/[\t ]/g)?.length ?? 0));
    }
    return arr;
  }, <number[]>[]);

  // 3. Remove the common indentation from all strings.
  if (indentLengths.length) {
    const pattern = new RegExp(`\n[\t ]{${Math.min(...indentLengths)}}`, 'g');

    strings = strings.map((str) => str.replace(pattern, '\n'));
  }

  // 4. Remove leading whitespace.
  strings[0] = strings[0].replace(/^\r?\n/, '');

  // 5. Perform interpolation.
  let string = strings[0];

  values.forEach((value, i) => {
    // 5.1 Read current indentation level
    const indentations = string.match(/(?:^|\n)( *)$/);
    const indentation = indentations ? indentations[1] : '';
    let indentedValue = value;

    // 5.2 Add indentation to values with multiline strings
    if (typeof value === 'string' && value.includes('\n')) {
      indentedValue = String(value)
        .split('\n')
        .map((str, i) => {
          return i === 0 ? str : `${indentation}${str}`;
        })
        .join('\n');
    }

    string += indentedValue + strings[i + 1];
  });

  return string;
}

export default dedent;
