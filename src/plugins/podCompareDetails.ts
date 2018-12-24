import {ActionGroupSpec, ActionContextType} from '../../src/actions/actionSpec'
import K8sPluginHelper from '../../src/util/k8sPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Pod,
  actions: [
    {
      name: "Compare Two Pods",
      order: 6,
      
      choose: K8sPluginHelper.choosePod.bind(null, 2, 2, false),

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, "Pods")
      },
    }
  ]
}

export default plugin
