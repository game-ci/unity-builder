import { TaskDefinitionFormation } from './cloud-formations/task-definition-formation.ts';

export class AWSCloudFormationTemplates {
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
      Name: '${p1}'
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
    return TaskDefinitionFormation.formation;
  }
}
