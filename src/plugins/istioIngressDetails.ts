import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Recipes",
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
          if(istioProxyContainer) {
            output.push(["Docker Image", istioProxyContainer.image])
            output.push(["Ports", istioProxyContainer.ports ? 
                          istioProxyContainer.ports.map(port => port.containerPort).join(", ") : ""])
            output.push(["Resources", istioProxyContainer.resources || ""])

            const volumesAndMounts: any[] = []
            podTemplate.volumes && podTemplate.volumes.forEach(volume => {
              const mountPaths = istioProxyContainer.volumeMounts ? 
                                istioProxyContainer.volumeMounts.filter(mount => mount.name === volume.name)
                                .map(mount => mount.mountPath) : []
              volumesAndMounts.push({
                volume: volume.name,
                secret: volume.secret.secretName,
                mountPath: mountPaths.length > 0 ? mountPaths[0] : ""
              })
            })
            output.push(["Volumes & Mounts", volumesAndMounts])
            output.push(["Replicas Available/Ready", ingressDeployment.status.availableReplicas
                                                      + "/" + ingressDeployment.status.readyReplicas])
          } else {
            output.push(["Istio Proxy Container Not Found", ""])
          }
          output.push(["Ingress Service", await IstioPluginHelper.getIstioServiceDetails("istio=ingressgateway", k8sClient)])
          output.push(["Ingress Pods", await IstioPluginHelper.getIstioServicePods("istio=ingressgateway", k8sClient)])
          output.push(["Ingress Gateways", await IstioPluginHelper.getIstioIngressGateways(k8sClient)])
          output.push(["Ingress VirtualServices", await IstioPluginHelper.getIstioIngressVirtualServices(k8sClient)])
          this.onStreamOutput  && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
