import k8sFunctions from '../../src/k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType} from '../../src/actions/actionSpec'
import K8sPluginHelper from '../../src/util/k8sPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  actions: [
    {
      name: "Compare Two Secrets",
      order: 11,
      async choose(actionContext) {
        await K8sPluginHelper.prepareChoices(actionContext, k8sFunctions.getNamespaceSecrets, "Secrets", 2, 2, "name")
      },

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, "Secrets", "name")
      },
    },
    {
      name: "Compare Two Config Maps",
      order: 12,
      async choose(actionContext) {
        await K8sPluginHelper.prepareChoices(actionContext, k8sFunctions.getNamespaceConfigMaps, "Config Maps", 2, 2, "name")
      },

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, "Config Maps")
      },
    },
    {
      name: "Compare Two Services",
      order: 13,
      async choose(actionContext) {
        await K8sPluginHelper.prepareChoices(actionContext, k8sFunctions.getNamespaceServices, "Services", 2, 2, "name")
      },

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, "Services")
      },
    },
    {
      name: "Compare Two Deployments",
      order: 14,
      async choose(actionContext) {
        await K8sPluginHelper.prepareChoices(actionContext, k8sFunctions.getNamespaceDeployments, "Deployments", 2, 2, "name")
      },

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, "Deployments")
      },
    }
  ]
}

export default plugin
