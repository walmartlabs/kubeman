import {ActionGroupSpec, ActionContextType} from '../actions/actionSpec'
import K8sPluginHelper from '../k8s/k8sPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",
  actions: [
    {
      name: "Compare Two Pods",
      order: 15,
      loadingMessage: "Loading Pods...",

      choose: K8sPluginHelper.choosePod.bind(K8sPluginHelper, 2, 2, false, true),

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, this.onOutput, "Pods")
      },
    }
  ]
}

export default plugin
