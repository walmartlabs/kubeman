import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "Check Ingress Envoy Listen Status",
      order: 35,
      loadingMessage: "Loading IngressGateway Pods...",

      async act(actionContext) {
        this.onOutput && this.onOutput([["IngressGateway Envoy Listen Status", ""]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          if(!cluster.hasIstio) {
            this.onStreamOutput && this.onStreamOutput([["Istio not installed"]])
            continue
          }
          const ingressPods = await IstioFunctions.getIngressGatewayPods(cluster.k8sClient)
          for(const ingressPod of ingressPods) {
            const output: ActionOutput = []
            output.push([">Ingress Pod: " + ingressPod.name + " on Cluster: " + cluster.name])
            const listenerConfigs = await IstioFunctions.getIngressGatewayEnvoyListeners(cluster.k8sClient, ingressPod.name)
            for(const l of listenerConfigs) {
              output.push([">>>Listener: " + l.title])
              const port = l.listener.address.socket_address.port_value
              const result = (await K8sFunctions.podExec("istio-system", ingressPod.name, "istio-proxy", cluster.k8sClient,
                              ["sh", "-c", "netstat -an | grep LISTEN | grep " + port])).toString()
              const isListening = result.includes("LISTEN") && result.includes(port)
              output.push(["Pod is " + (isListening ? "" : "NOT ") + " listening on port " + port])
            }
            this.onStreamOutput && this.onStreamOutput(output)
          }
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
