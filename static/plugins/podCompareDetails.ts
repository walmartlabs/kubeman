import _ from 'lodash'
import k8sFunctions from '../../src/k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType} from '../../src/actions/actionSpec'
import K8sComparisonUtil from '../util/k8sComparisonUtil'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Pod,
  actions: [
    {
      name: "Compare Two Pods",
      order: 3,
      
      choose(actionContext) {
        K8sComparisonUtil.prepareChoices(actionContext, 
          (cluster, namespace, k8sClient) => {
            const namespaces = actionContext.getNamespaces()
            const pods = _.flatMap(namespaces.filter(ns => 
              ns.cluster.name === cluster && ns.name === namespace),
              ns => ns.pods.map(pod => pod.name))
            return k8sFunctions.getPodsDetails(namespace, pods, k8sClient)
          },
        "Pods", 2, 2, "name")
      },

      async act(actionContext) {
        K8sComparisonUtil.prepareOutput(actionContext, "Pods")
      },
    }
  ]
}

export default plugin
