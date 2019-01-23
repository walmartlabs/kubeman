import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle } from '../actions/actionSpec'
import ActionContext from '../actions/actionContext'
import K8sPluginHelper from '../k8s/k8sPluginHelper';
import K8sFunctions from '../k8s/k8sFunctions';
import IstioPluginHelper from '../k8s/istioPluginHelper';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      order: 3,
      name: "List CRDs",
      async act(actionContext: ActionContext) {
        this.onOutput && this.onOutput([["Name", "Labels", "StoredVersions", "Created At", "Status"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        for(const i in clusters) {
          const output : ActionOutput  = []
          const cluster = clusters[i]
          output.push([">Cluster: " + cluster.name, "", "", "", ""])
          const crds = await K8sFunctions.getClusterCRDs(cluster.k8sClient)
          crds.forEach(crd => output.push([crd.name, crd.labels, crd.storedVersions, 
                                            crd.creationTimestamp, crd.conditions]))
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      }
    },
    {
      order: 4,
      name: "CRD Details",
      
      choose: K8sPluginHelper.chooseCRDs.bind(IstioPluginHelper, 1, 10),

      async act(actionContext: ActionContext) {
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
    }
  ]
}

export default plugin
