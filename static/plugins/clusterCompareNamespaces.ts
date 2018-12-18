import k8sFunctions from '../../src/k8s/k8sFunctions'
import {K8sClient} from '../../src/k8s/k8sClient'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../../src/actions/actionSpec'

async function compareClusterNamespaces(cluster1: string, k8sClient1: K8sClient, 
                                        cluster2: string, k8sClient2: K8sClient, 
                                        output: ActionOutput) {
  const namespaces1 = await k8sFunctions.getClusterNamespaces(cluster1, k8sClient1)
  const namespaces2 = await k8sFunctions.getClusterNamespaces(cluster2, k8sClient2)
  const allNamespaces = {}

  namespaces1.forEach(ns => allNamespaces[ns.name]=["Yes", "No"])
  namespaces2.forEach(ns => allNamespaces[ns.name]=
      [allNamespaces[ns.name]?allNamespaces[ns.name][0]:"No", "Yes"])

  Object.keys(allNamespaces).forEach(ns => output.push([ns, 
    allNamespaces[ns][0], allNamespaces[ns][1]]))
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      order: 3,
      name: "List/Compare Namespaces",
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()

        if(clusters.length < 2 || k8sClients.length < 2) {
          actionContext.onOutput && actionContext.onOutput([["Not enough clusters to compare"]], ActionOutputStyle.Text)
          return
        }

        const output: ActionOutput = []
        const cluster1 = clusters[0].name
        const cluster2 = clusters[1].name
        output.push(["Namespaces", "Cluster: " + cluster1, "Cluster: " + cluster2])
        await compareClusterNamespaces(cluster1, k8sClients[0], cluster2, k8sClients[1], output)
        actionContext.onOutput && actionContext.onOutput(output, ActionOutputStyle.Compare)
      },
    },
  ]
}

export default plugin
