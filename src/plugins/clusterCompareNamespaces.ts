import k8sFunctions from '../k8s/k8sFunctions'
import {K8sClient} from '../k8s/k8sClient'
import K8sPluginHelper from '../k8s/k8sPluginHelper'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'

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
      name: "Compare Namespaces",
      order: 4,
      
      choose: K8sPluginHelper.chooseClusters,

      async act(actionContext) {
        const clusters = K8sPluginHelper.getSelectedClusters(actionContext)
        if(clusters.length < 2) {
          this.onOutput && this.onOutput([["Not enough clusters to compare"]], ActionOutputStyle.Text)
          return
        }
        this.showOutputLoading && this.showOutputLoading(true)
        const output: ActionOutput = []
        const cluster1 = clusters[0].name
        const cluster2 = clusters[1].name
        output.push(["Namespaces", "Cluster: " + cluster1, "Cluster: " + cluster2])
        await compareClusterNamespaces(cluster1, clusters[0].k8sClient, 
                                        cluster2, clusters[1].k8sClient, output)
        this.onOutput && this.onOutput(output, ActionOutputStyle.Compare)
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
  ]
}

export default plugin
