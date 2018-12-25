import k8sFunctions from '../../src/k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle } from '../../src/actions/actionSpec'
import ActionContext from '../../src/actions/actionContext'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      order: 3,
      name: "List Namespaces",
      async act(actionContext: ActionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()
        const output : ActionOutput  = []
        output.push([
          "Namespace", 
          "Created",
          "Status"
        ])
        for(const i in clusters) {
          const cluster = clusters[i].name
          output.push([">Cluster: " + cluster, "", ""])
          const namespaces = await k8sFunctions.getClusterNamespaces(cluster, k8sClients[i])
          namespaces.forEach(ns => output.push([ns.name, ns.creationTimestamp, ns.status]))
        }
        actionContext.onOutput && actionContext.onOutput(output, ActionOutputStyle.Table)
      }
    },
  ]
}

export default plugin
