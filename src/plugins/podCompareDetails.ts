import {ActionGroupSpec, ActionContextType} from '../actions/actionSpec'
import K8sPluginHelper from '../k8s/k8sPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Actions",
  actions: [
    {
      name: "Compare Two Pods",
      order: 6,
      
      choose: K8sPluginHelper.choosePod.bind(K8sPluginHelper, 2, 2, false, true),

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, "Pods")
      },
    }
  ]
}

export default plugin
