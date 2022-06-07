import fs from '../../../node_modules/fs';
import * as path from 'https://deno.land/std@0.141.0/path/mod.ts';
import YAML from '../../../node_modules/yaml';

export class ActionYamlReader {
  private actionYamlParsed: any;
  public constructor() {
    let filename = `action.yml`;
    if (!fs.existsSync(filename)) {
      filename = path.join(__dirname, `..`, filename);
    }
    this.actionYamlParsed = YAML.parse(fs.readFileSync(filename).toString());
  }
  public GetActionYamlValue(key: string) {
    return this.actionYamlParsed.inputs[key]?.description || 'No description found in action.yml';
  }
}
