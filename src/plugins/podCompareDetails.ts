import _ from 'lodash'
import k8sFunctions from '../../src/k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType} from '../../src/actions/actionSpec'
import K8sPluginHelper from '../util/k8sPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Pod,
  actions: [
    {
      name: "Compare Two Pods",
      order: 3,
      
      choose: K8sPluginHelper.choosePod.bind(null, 2, 2, false),

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, "Pods")
      },
    }
  ]
}

export default plugin
