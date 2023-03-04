import { TaskDefinitionFormation } from './cloud-formations/task-definition-formation';

export class AWSCloudFormationTemplates {
  public static getParameterTemplate(p1: string) {
    return `
  ${p1}:
    Type: String
    Default: ''
`;
  }

  public static getSecretTemplate(p1: string) {
    return `
  ${p1}Secret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: '${p1}'
      SecretString: !Ref ${p1}
`;
  }

  public static getSecretDefinitionTemplate(p1: string, p2: string) {
    return `
            - Name: '${p1}'
              ValueFrom: !Ref ${p2}Secret
`;
  }

  public static insertAtTemplate(template: string, insertionKey: string, insertion: string) {
    const index = template.search(insertionKey) + insertionKey.length + '\n'.length;
    template = [template.slice(0, index), insertion, template.slice(index)].join('');

    return template;
  }

  public static readTaskCloudFormationTemplate(): string {
    return TaskDefinitionFormation.formation;
  }
}
