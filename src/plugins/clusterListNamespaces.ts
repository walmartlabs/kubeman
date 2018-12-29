import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle } from '../actions/actionSpec'
import ActionContext from '../actions/actionContext'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      order: 3,
      name: "List Namespaces",
      async act(actionContext: ActionContext) {
        const clusters = actionContext.getClusters()
        const output : ActionOutput  = []
        output.push([
          "Namespace", 
          "Created",
          "Status"
        ])
        for(const i in clusters) {
          const cluster = clusters[i]
          output.push([">Cluster: " + cluster.name, "", ""])
          const namespaces = await k8sFunctions.getClusterNamespaces(cluster.name, cluster.k8sClient)
          namespaces.forEach(ns => output.push([ns.name, ns.creationTimestamp, ns.status]))
        }
        actionContext.onOutput && actionContext.onOutput(output, ActionOutputStyle.Table)
      }
    },
  ]
}

export default plugin
