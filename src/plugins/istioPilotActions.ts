import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions';
import ChoiceManager from '../actions/choiceManager';
import { ServiceDetails } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Pilot Recipes",
  order: ActionContextOrder.Istio+2,
  actions: [
    {
      name: "View Pilot Metrics",
      order: 40,
      autoRefreshDelay: 15,
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Pilot Metrics"]], ActionOutputStyle.Log)
        this.showOutputLoading && this.showOutputLoading(true)
        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          const result = await IstioFunctions.getPilotMetrics(cluster.k8sClient)
          this.onStreamOutput && this.onStreamOutput([[">Cluster: " + cluster.name]])
          this.onStreamOutput && this.onStreamOutput(result ? result.split("\n").map(line => [line]) : [[""]])
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
    },
    {
      name: "View Service Endpoints Known to Pilot",
      order: 41,
      loadingMessage: "Loading Services...",
      
      async choose(actionContext) {
        await ChoiceManager.prepareChoices(actionContext, K8sFunctions.getServices, 
                                                  "Services", 1, 10, true, "name")
      },
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Service Endpoints Known to Pilot"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        const selections = await ChoiceManager.getSelections(actionContext)
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
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    }
  ]
}

export default plugin
