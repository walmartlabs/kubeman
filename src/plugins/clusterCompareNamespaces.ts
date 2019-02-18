import k8sFunctions from '../k8s/k8sFunctions'
import {K8sClient} from '../k8s/k8sClient'
import K8sPluginHelper from '../k8s/k8sPluginHelper'
import {ActionGroupSpec, ActionContextType, ActionContextOrder,
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  title: "Namespace Recipes",
  order: ActionContextOrder.Namespace,
  actions: [
    {
      name: "Compare Cluster Namespaces",
      order: 11,
      
      choose: K8sPluginHelper.chooseClusters,

      async act(actionContext) {
        const clusters = K8sPluginHelper.getSelectedClusters(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)
        const allNamespaces = {}
        for(const ci in clusters) {
          const cluster  = clusters[ci]
          const namespaces = await k8sFunctions.getClusterNamespaces(cluster.k8sClient)
          namespaces.forEach(ns => {
            if(!allNamespaces[ns.name]) {
              allNamespaces[ns.name] = []
            }
            allNamespaces[ns.name][ci]=true
          })
        }
        const output: ActionOutput = []
        const headers = ["Namespace"]
        clusters.forEach(cluster => {
          headers.push("Cluster: " + cluster.name)
        })
        output.push(headers)
        const clusterCount = clusters.length
        Object.keys(allNamespaces).forEach(ns => {
          const row: any[] = [ns]
          for(let i = 0; i < clusterCount; i++) {
            row.push(allNamespaces[ns][i] ? "Yes" : "No")
          }
          output.push(row)
        })
        this.onOutput && this.onOutput(output, ActionOutputStyle.Compare)
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
  ]
}

export default plugin
