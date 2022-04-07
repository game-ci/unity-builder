import FS from 'fs';
import Path from 'path';

const targets = new Array();
const Files: any[] = [];

export function ThroughDirectory(Directory) {
  for (const File of FS.readdirSync(Directory)) {
    const Absolute = Path.join(Directory, File);
    if (Absolute.includes(`__`)) {
      continue;
    }
    if (Absolute.includes('.test.ts')) {
      continue;
    }
    if (Absolute.includes('jest')) {
      continue;
    }
    if (Absolute === __dirname) {
      continue;
    }
    if (FS.statSync(Absolute).isDirectory()) {
      ThroughDirectory(Absolute);
      continue;
    }
    if (Absolute.endsWith('.ts')) {
      Files.push(Absolute);
      continue;
    }
    continue;
  }
  return Files;
}

export function RequireAll(folder) {
  const files = ThroughDirectory(folder);
  for (const element of files) {
    require(Path.relative(__dirname, element));
  }
}

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
    throw new Error(`no CLI mode found for ${key}`);
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
