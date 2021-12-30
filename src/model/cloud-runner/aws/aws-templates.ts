import * as fs from 'fs';

export class AWSTemplates {
  public static getParameterTemplate(p1) {
    return `
  ${p1}:
    Type: String
    Default: ''
`;
  }

  public static getSecretTemplate(p1) {
    return `
  ${p1}Secret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: !Join [ "", [ '${p1}', !Ref BUILDGUID ] ]
      SecretString: !Ref ${p1}
`;
  }

  public static getSecretDefinitionTemplate(p1, p2) {
    return `
            - Name: '${p1}'
              ValueFrom: !Ref ${p2}Secret
`;
  }

  public static insertAtTemplate(template, insertionKey, insertion) {
    const index = template.search(insertionKey) + insertionKey.length + '\n'.length;
    template = [template.slice(0, index), insertion, template.slice(index)].join('');
    return template;
  }

  public static readTaskCloudFormationTemplate(): string {
    return fs.readFileSync(`${__dirname}/cloud-formations/task-def-formation.yml`, 'utf8');
  }
}
