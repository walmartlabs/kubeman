import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import IstioFunctions from '../k8s/istioFunctions'
import ChoiceManager from '../actions/choiceManager'
import { ContainerInfo, Cluster } from '../k8s/k8sObjectTypes'
import StreamLogger from '../logger/streamLogger'
import OutputManager from '../output/outputManager';


async function tailIngressPodLogs(cluster: Cluster, rowLimit, onStreamOutput, showOutputLoading, setScrollMode, ...filters) {
  const ingressPods = await IstioFunctions.getIngressGatewayPods(cluster.k8sClient, true)
  showOutputLoading(true)
  setScrollMode(false)
  const podRowLimit = Math.ceil((rowLimit || 200)/ingressPods.length)
  StreamLogger.init(rowLimit, onStreamOutput, ...filters)
  filters.length > 0 && OutputManager.filter(filters.join(" "))

  for(const ingressPod of ingressPods) {
    const logStream = await K8sFunctions.getPodLog("istio-system", ingressPod.name, "istio-proxy", cluster.k8sClient, true, podRowLimit)
    StreamLogger.captureLogStream(ingressPod.name, logStream)
  }
  showOutputLoading(false)
}


const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  order: ActionContextOrder.Istio+1,

  actions: [
    {
      name: "Tail Ingress Logs",
      order: 3,
      outputRowLimit: 100,

      choose: ChoiceManager.chooseClusters.bind(ChoiceManager, 1, 1),
      
      async act(actionContext) {
        this.clear && this.clear(actionContext)
        const cluster = ChoiceManager.getSelectedClusters(actionContext)[0]
        await tailIngressPodLogs(cluster, this.outputRowLimit, this.onStreamOutput, this.showOutputLoading, this.setScrollMode)
      },

      stop(actionContext) {
        StreamLogger.stop()
      },

      clear(actionContext) {
        this.onOutput && this.onOutput([["Tail Istio IngressGateway Logs (All Pods)", ""]], ActionOutputStyle.Log)
      },
    },
    {
      name: "Tail Filtered Ingress Logs",
      order: 4,
      outputRowLimit: 100,
      selectedCluster: undefined,
      filter: undefined,

      choose: ChoiceManager.chooseClusters.bind(ChoiceManager, 1, 1),
      
      async act(actionContext) {
        this.clear && this.clear(actionContext)
        this.selectedCluster = ChoiceManager.getSelectedClusters(actionContext)[0]
      },
      
      async react(actionContext) {
        this.filter = actionContext.inputText
        this.clear && this.clear(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)
        await tailIngressPodLogs(this.selectedCluster, this.outputRowLimit, this.onStreamOutput, this.showOutputLoading, this.setScrollMode, this.filter)
        this.showOutputLoading && this.showOutputLoading(false)
      },

      stop(actionContext) {
        StreamLogger.stop()
      },

      clear() {
        let title = "Tail Filtered Istio IngressGateway Logs (All Pods)"
        if(this.filter) {
          title += ", Applied Filter: [ " + this.filter + " ]"
        }
        this.onOutput && this.onOutput([[title, ""]], ActionOutputStyle.Log)
      },
    }
  ]
}

export default plugin
