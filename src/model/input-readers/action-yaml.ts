import fs from 'fs';
import YAML from 'yaml';

export class ActionYamlReader {
  private actionYamlParsed: any;
  public constructor() {
    this.actionYamlParsed = YAML.parse(fs.readFileSync(`action.yml`).toString());
  }
  public GetActionYamlValue(key: string) {
    return this.actionYamlParsed.inputs[key]?.description || 'No description found in action.yml';
  }
}
