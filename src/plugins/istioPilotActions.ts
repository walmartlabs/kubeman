import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions';
import K8sPluginHelper from '../k8s/k8sPluginHelper';
import { ServiceDetails } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Pilot Recipes",
  order: ActionContextOrder[ActionContextType.Istio]+2,
  actions: [
    {
      name: "View Pilot Metrics",
      order: 40,
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Pilot Metrics"]], ActionOutputStyle.Log)
        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          const result = await IstioFunctions.getPilotMetrics(cluster.k8sClient)
          this.onStreamOutput && this.onStreamOutput([
            [">Cluster: " + cluster.name],
            [result]
          ])
        }
      },
    },
    {
      name: "View Pilot-Sidecars Sync Status",
      order: 41,
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Pilot-Sidecars Sync Status"]], ActionOutputStyle.Log)
        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          const result = await IstioFunctions.getPilotSidecarSyncStatus(cluster.k8sClient)
          this.onStreamOutput && this.onStreamOutput([
            [">Cluster: " + cluster.name],
            [result]
          ])
        }
      },
    },
    {
      name: "View Service Endpoints Known to Pilot",
      order: 42,
      
      async choose(actionContext) {
        await K8sPluginHelper.prepareChoices(actionContext, K8sFunctions.getNamespaceServices, "Services", 1, 10, "name")
      },
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Service Endpoints Known to Pilot"]], ActionOutputStyle.Table)
          const selections = await K8sPluginHelper.getSelections(actionContext, "name")
        for(const selection of selections) {
          const cluster = actionContext.getClusters().filter(c => c.name === selection.cluster)[0]
          const service = selection.item as ServiceDetails
          const namespace = selection.namespace
          const endpoints = await IstioFunctions.getPilotEndpoints(cluster.k8sClient, service.name, namespace)
          this.onStreamOutput && this.onStreamOutput([
            [">Service: " + service.name + ", Namespace: " + namespace + ", Cluster: " + cluster.name],
            [endpoints]
          ])
        }
      },
    }
  ]
}

export default plugin
