import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import IstioFunctions from '../k8s/istioFunctions';
import ChoiceManager from '../actions/choiceManager';
import { ContainerInfo } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  order: ActionContextOrder.Istio+1,

  actions: [
    {
      name: "Tail Ingress Logs",
      order: 11,

      logStreams: [],
      buffer: [],
      renderTimer: undefined,

      choose: ChoiceManager.chooseClusters.bind(ChoiceManager, 1, 1),
      
      renderLog() {
        this.onStreamOutput && this.onStreamOutput(this.buffer)
      },

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
        this.setScrollMode && this.setScrollMode(true)

        for(const ingressPodAndContainer of ingressPodsAndContainers) {
          const title = ingressPodAndContainer[1] + "@" + ingressPodAndContainer[0]
          const logStream = await K8sFunctions.getPodLog("istio-system", ingressPodAndContainer[0], 
                                    ingressPodAndContainer[1], cluster.k8sClient, true, 20)
          logStream.onLog(lines => {
            lines = lines.split("\n")
                    .filter(line => line.length > 0)
                    .slice(-50)
                    .map(line => [title, line])
            this.buffer = this.buffer.length > 50 ? this.buffer.slice(-50) : this.buffer
            this.buffer = this.buffer.concat(lines)
            if(this.renderTimer) {
              clearTimeout(this.renderTimer)
            }
            this.renderTimer = setTimeout(this.renderLog.bind(this), 2000)
          })
          this.logStreams.push(logStream)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      stop(actionContext) {
        if(this.logStreams.length > 0) {
          this.logStreams.forEach(stream => stream.stop())
          this.logStreams = []
        }
      },
      clear() {
        this.onOutput && this.onOutput([["Istio IngressGateway Logs", ""]], ActionOutputStyle.Log)
      },
    }
  ]
}

export default plugin
