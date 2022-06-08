import { fsSync as fs, path, YAML, __dirname } from '../../dependencies.ts';

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
