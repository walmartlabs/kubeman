import k8sFunctions from '../../src/k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType} from '../../src/actions/actionSpec'
import K8sComparisonUtil from '../util/k8sComparisonUtil'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Compare Namespace Objects",
  actions: [
    {
      name: "Compare Two Secrets",
      order: 1,
      async choose(actionContext) {
        await K8sComparisonUtil.prepareChoices(actionContext, k8sFunctions.getNamespaceSecrets, "Secrets", 2, 2, "name")
      },

      async act(actionContext) {
        K8sComparisonUtil.prepareOutput(actionContext, "Secrets", "name")
      },
    },
    {
      name: "Compare Two Config Maps",
      order: 2,
      async choose(actionContext) {
        await K8sComparisonUtil.prepareChoices(actionContext, k8sFunctions.getNamespaceConfigMaps, "Config Maps", 2, 2, "name")
      },

      async act(actionContext) {
        K8sComparisonUtil.prepareOutput(actionContext, "Config Maps")
      },
    },
    {
      name: "Compare Two Services",
      order: 3,
      async choose(actionContext) {
        await K8sComparisonUtil.prepareChoices(actionContext, k8sFunctions.getNamespaceServices, "Services", 2, 2, "name")
      },

      async act(actionContext) {
        K8sComparisonUtil.prepareOutput(actionContext, "Secrets")
      },
    },
    {
      name: "Compare Two Deployments",
      order: 4,
      async choose(actionContext) {
        await K8sComparisonUtil.prepareChoices(actionContext, k8sFunctions.getNamespaceDeployments, "Deployments", 2, 2, "name")
      },

      async act(actionContext) {
        K8sComparisonUtil.prepareOutput(actionContext, "Deployments")
      },
    }
  ]
}

export default plugin
