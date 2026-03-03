import { RbacAuthorizationV1Api } from '@kubernetes/client-node';

class KubernetesRole {
  static async createRole(serviceAccountName: string, namespace: string, rbac: RbacAuthorizationV1Api) {
    // create admin kubernetes role and role binding
    const roleBinding = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        name: `${serviceAccountName}-admin`,
        namespace,
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: serviceAccountName,
          namespace,
        },
      ],
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: `${serviceAccountName}-admin`,
      },
    };

    const role = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'Role',
      metadata: {
        name: `${serviceAccountName}-admin`,
        namespace,
      },
      rules: [
        {
          apiGroups: ['*'],
          resources: ['*'],
          verbs: ['*'],
        },
      ],
    };
    const roleBindingResponse = await rbac.createNamespacedRoleBinding(namespace, roleBinding);
    const roleResponse = await rbac.createNamespacedRole(namespace, role);

    return { roleBindingResponse, roleResponse };
  }

  public static async deleteRole(serviceAccountName: string, namespace: string, rbac: RbacAuthorizationV1Api) {
    await rbac.deleteNamespacedRoleBinding(`${serviceAccountName}-admin`, namespace);
    await rbac.deleteNamespacedRole(`${serviceAccountName}-admin`, namespace);
  }
}
export { KubernetesRole };
