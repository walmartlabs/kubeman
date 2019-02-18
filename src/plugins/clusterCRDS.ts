import {ActionGroupSpec, ActionContextType, ActionContextOrder,
        ActionOutput, ActionOutputStyle } from '../actions/actionSpec'
import ActionContext from '../actions/actionContext'
import K8sPluginHelper from '../k8s/k8sPluginHelper';
import K8sFunctions from '../k8s/k8sFunctions';
import IstioPluginHelper from '../k8s/istioPluginHelper';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  title: "Resources",
  order: ActionContextOrder.Resources,
  actions: [
    {
      order: 1,
      name: "List All CRDs",
      async act(actionContext) {
        this.onOutput && this.onOutput([["CRD", "Labels", "Version", "Status"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          const output : ActionOutput  = []
          output.push([">Cluster: " + cluster.name, "", "", ""])
          const crds = await K8sFunctions.getClusterCRDs(cluster.k8sClient)
          crds.forEach(crd => output.push([
            crd.name + "<br/>(created: "+crd.creationTimestamp+")", 
            crd.labels, crd.storedVersions, 
            crd.conditions.map(c => c.type+"="+c.status)
          ]))
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      }
    },
    {
      order: 2,
      name: "Compare All CRDs",
      
      choose: K8sPluginHelper.chooseClusters,

      async act(actionContext) {
        const clusters = K8sPluginHelper.getSelectedClusters(actionContext)
        const headers = ["CRD"]
        clusters.forEach(cluster => {
          headers.push("Cluster: " + cluster.name)
        })
        this.onOutput && this.onOutput([headers], ActionOutputStyle.Compare)
        this.showOutputLoading && this.showOutputLoading(true)

        const crdsMap = {}
        for(const cluster of clusters) {
          const crds = await K8sFunctions.getClusterCRDs(cluster.k8sClient)
          for(const crd of crds) {
            if(!crdsMap[crd.name]) {
              crdsMap[crd.name] = {}
            }
            crdsMap[crd.name][cluster.name] = crd.storedVersions
          }
        }
        const output : ActionOutput  = []
        Object.keys(crdsMap).forEach(crd => {
          const row = [crd]
          clusters.forEach(cluster => {
            row.push(crdsMap[crd][cluster.name] || "N/A")
          })
          output.push(row)
        })
        this.onStreamOutput && this.onStreamOutput(output)
        this.showOutputLoading && this.showOutputLoading(false)
      }
    },
    {
      order: 3,
      name: "CRD Details",
      loadingMessage: "Loading CRDs...",
      
      choose: K8sPluginHelper.chooseCRDs.bind(K8sPluginHelper, 1, 10),

      async act(actionContext) {
        const selections = await K8sPluginHelper.getSelections(actionContext)
        this.onOutput && this.onOutput([["CRD Details"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        for(const selection of selections) {
          this.onStreamOutput && this.onStreamOutput([
            [">"+selection.title],
            [selection.item]
          ])
        }
        this.showOutputLoading && this.showOutputLoading(false)
      }
    },
    {
      order: 4,
      name: "CRD Resource Instances",
      loadingMessage: "Loading CRDs...",
      
      choose: K8sPluginHelper.chooseCRDs.bind(K8sPluginHelper, 1, 10),

      async act(actionContext) {
        const selections = await K8sPluginHelper.getSelections(actionContext)
        this.onOutput && this.onOutput([["CRD Resource Instances"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        const clusters = actionContext.getClusters()
        for(const selection of selections) {
          const crd = selection.title
          const cluster =clusters.filter(c => c.name === selection.cluster)[0]
          const output : ActionOutput  = []
          output.push([">" + crd + " @ Cluster: " + cluster.name])
          const result = await cluster.k8sClient.crds[crd].get()
          if(result && result.body) {
            result.body.items.forEach(r => output.push([">>"+r.metadata.name], [r]))
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      }
    }
  ]
}

export default plugin
