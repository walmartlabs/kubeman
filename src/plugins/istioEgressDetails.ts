import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Recipes",
  actions: [
    {
      name: "View Egress Details",
      order: 12,
      
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput && this.onOutput([["", "Istio EgressGateway Details"]], ActionOutputStyle.Table)

        for(const i in clusters) {
          const cluster = clusters[i]
          const output: ActionOutput = []
          const k8sClient = cluster.k8sClient
          const egressDeployment = await K8sFunctions.getDeploymentDetails(cluster.name, 
                                      "istio-system", "istio-egressgateway", k8sClient)
          if(!egressDeployment) {
            this.onStreamOutput && this.onStreamOutput(["istio-egressgateway not found", ""])
            continue
          } 
          output.push([">" + egressDeployment.name + ", Cluster: " + cluster.name, ""])
          output.push(["Replicas", egressDeployment.replicas])
          const podTemplate = egressDeployment.template
          const istioProxyContainer = podTemplate.containers.filter(c => c.name === "istio-proxy")[0]
          output.push(["Docker Image", istioProxyContainer.image])
          output.push(["Ports", istioProxyContainer.ports ? 
                        istioProxyContainer.ports.map(port => port.containerPort).join(", ") : ""])
          output.push(["Resources", istioProxyContainer.resources || ""])
          output.push(["Replicas Available/Ready", egressDeployment.status.availableReplicas
                                                    + "/" + egressDeployment.status.readyReplicas])

          output.push(["Egress Service", await IstioPluginHelper.getIstioServiceDetails("istio=egressgateway", k8sClient)])
          output.push(["Egress Pods", await IstioPluginHelper.getIstioServicePods("istio=egressgateway", k8sClient)])
          output.push(["Egress Gateways", await IstioPluginHelper.getIstioEgressGateways(k8sClient)])
          output.push(["Egress VirtualServices", await IstioPluginHelper.getIstioEgressVirtualServices(k8sClient)])

          this.onStreamOutput && this.onStreamOutput(output)
        }
      },
    }
  ]
}

export default plugin
