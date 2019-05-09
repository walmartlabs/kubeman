import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import IstioFunctions from '../k8s/istioFunctions'
import ChoiceManager from '../actions/choiceManager'
import { ContainerInfo } from '../k8s/k8sObjectTypes'
import StreamLogger from '../logger/streamLogger'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  order: ActionContextOrder.Istio+1,

  actions: [
    {
      name: "Tail Ingress Logs",
      order: 11,
      outputRowLimit: 100,

      choose: ChoiceManager.chooseClusters.bind(ChoiceManager, 1, 1),
      
      async act(actionContext) {
        const cluster = ChoiceManager.getSelectedClusters(actionContext)[0]
        const ingressPods = await IstioFunctions.getIngressGatewayPods(cluster.k8sClient, true)
        const ingressPodsAndContainers = _.flatten(ingressPods.map(p => p.podDetails)
                                            .map(pd => pd && [pd.name, pd.containers])
                                            .filter(pair => pair)
                                            .map(pair => pair && 
                                              (pair[1] as ContainerInfo[]).map(c => [pair[0], c.name])))
        this.onOutput && this.onOutput([["Istio IngressGateway Logs", ""]], ActionOutputStyle.Log)
        this.showOutputLoading && this.showOutputLoading(true)
        this.setScrollMode && this.setScrollMode(false)

        StreamLogger.init(this.outputRowLimit, this.onStreamOutput)
        const podRowLimit = Math.ceil((this.outputRowLimit || 200)/ingressPodsAndContainers.length)

        for(const ingressPodAndContainer of ingressPodsAndContainers) {
          const title = ingressPodAndContainer[1] + "@" + ingressPodAndContainer[0]
          const logStream = await K8sFunctions.getPodLog("istio-system", ingressPodAndContainer[0], 
                                    ingressPodAndContainer[1], cluster.k8sClient, true, podRowLimit)
          StreamLogger.captureLogStream(title, logStream)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },

      stop(actionContext) {
        StreamLogger.stop()
      },

      clear() {
        this.onOutput && this.onOutput([["Istio IngressGateway Logs", ""]], ActionOutputStyle.Log)
      },
    }
  ]
}

export default plugin
