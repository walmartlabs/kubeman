import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType} from '../actions/actionSpec'
import K8sPluginHelper from '../k8s/k8sPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  actions: [
    {
      name: "Compare Two Secrets",
      order: 21,
      async choose(actionContext) {
        await K8sPluginHelper.prepareChoices(actionContext, k8sFunctions.getNamespaceSecrets, "Secrets", 2, 2, "name")
      },

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, "Secrets", "name")
      },
    },
    {
      name: "Compare Two Config Maps",
      order: 22,
      async choose(actionContext) {
        await K8sPluginHelper.prepareChoices(actionContext, k8sFunctions.getNamespaceConfigMaps, "Config Maps", 2, 2, "name")
      },

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, "Config Maps")
      },
    },
    {
      name: "Compare Two Services",
      order: 23,
      async choose(actionContext) {
        await K8sPluginHelper.prepareChoices(actionContext, k8sFunctions.getNamespaceServices, "Services", 2, 2, "name")
      },

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, "Services")
      },
    },
    {
      name: "Compare Two Deployments",
      order: 24,
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
