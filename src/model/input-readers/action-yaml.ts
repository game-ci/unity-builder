import fs from 'fs';
import YAML from 'yaml';

export class ActionYamlReader {
  public static Instance: ActionYamlReader;
  private actionYamlParsed: any;
  constructor() {
    ActionYamlReader.Instance = this;
    this.actionYamlParsed = YAML.parse(fs.readFileSync(`action.yml`).toString());
  }
  public GetActionYamlValue(key: string) {
    return this.actionYamlParsed.inputs[key];
  }
}
