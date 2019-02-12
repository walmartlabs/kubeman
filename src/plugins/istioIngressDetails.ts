import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import IstioFunctions from '../k8s/istioFunctions';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  order: ActionContextOrder[ActionContextType.Istio]+1,
  actions: [
    {
      name: "View Ingress Details",
      order: 10,
      
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput &&
          this.onOutput([["", "Istio IngressGateway Details"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name, ""]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["", "Istio not installed"]])
            continue
          }
          const output: ActionOutput = []
          const k8sClient = cluster.k8sClient
          const ingressDeployment = await K8sFunctions.getDeploymentDetails(cluster.name, 
                                      "istio-system", "istio-ingressgateway", k8sClient)
          if(!ingressDeployment) {
            this.onStreamOutput && this.onStreamOutput(["istio-ingressgateway not found", ""])
            continue
          } 
          output.push(["Replicas", ingressDeployment.replicas])
          const podTemplate = ingressDeployment.template
          const istioProxyContainer = podTemplate.containers.filter(c => c.name === "istio-proxy" 
                                      || c.name === 'ingressgateway')[0]
          output.push(["Labels", podTemplate.labels])
          output.push(["Istio-Proxy Container", istioProxyContainer])
          const istioSDSContainer = podTemplate.containers.filter(c => c.name === "ingress-sds")

          if(istioSDSContainer.length > 0) {
            output.push(["SDS Container", istioSDSContainer])
          }
          output.push(["Ingress Service", await IstioFunctions.getIstioServiceDetails("istio=ingressgateway", k8sClient)])
          output.push(["Ingress Pods", await IstioFunctions.getIngressGatewayPods(k8sClient)])
          output.push(["Ingress Gateways", await IstioFunctions.listAllIngressGateways(k8sClient, false)])
          output.push(["Ingress VirtualServices", await IstioFunctions.listAllIngressVirtualServices(k8sClient, false)])
          this.onStreamOutput  && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
