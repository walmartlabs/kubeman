import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import IstioFunctions from '../k8s/istioFunctions';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "Ingress Certs Report",
      order: 15,
      
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput &&
          this.onOutput([["Ingress Cert Secret", "Usage"]], ActionOutputStyle.Table)

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
          const podTemplate = ingressDeployment.template
          const istioProxyContainer = podTemplate.containers.filter(c => c.name === "istio-proxy" 
                                      || c.name === 'ingressgateway')[0]

          if(!istioProxyContainer) {
            this.onStreamOutput && this.onStreamOutput(["proxy container not found in ingressgateway", ""])
            continue
          }

          const gateways = await IstioPluginHelper.getIstioIngressGateways(k8sClient)
          const virtualServices = await IstioFunctions.listAllIngressVirtualServices(k8sClient)
          podTemplate.volumes && podTemplate.volumes.forEach(volume => {
            const mountPaths = istioProxyContainer.volumeMounts ? 
                                istioProxyContainer.volumeMounts.filter(mount => mount.name === volume.name)
                                .map(mount => mount.mountPath) : []

            
            const serverFilter = (server) =>  server.tls && server.tls.privateKey && mountPaths.length > 0 
                                          && server.tls.privateKey.includes(mountPaths[0])

            const certGateways = gateways.filter(gateway => 
                    gateway.servers.filter(serverFilter).length > 0)
                    .map(gateway => {
                      const servers = gateway.servers.filter(serverFilter)
                      return {
                        name: gateway.name,
                        namespace: gateway.namespace,
                        hosts: _.flatten(servers.map(server => server.hosts)),
                        ports: servers.map(server => server.port),
                        tls: servers.map(server => server.tls)
                      }
                    })

            const certVirtualServices = virtualServices.filter(vs => 
              certGateways.filter(g => 
                vs.gateways.filter(vsg => vsg.includes(g.name)).length > 0
                && vs.hosts.filter(vsh => g.hosts.filter(gh => gh.includes(vsh)).length > 0).length > 0
              ).length > 0)
            const isAnyVSUsingCert = certVirtualServices.filter(vs => vs.tls).length > 0

            output.push([
              volume.secret.secretName +
                (isAnyVSUsingCert ? "" 
                : certVirtualServices.length === 0 ? " <span style='color:red'>(not used by any VirtualService)</span>"
                : " <span style='color:red'>(not in use by any of the "+certVirtualServices.length+" VirtualServices)</span>"
                ),
              {
                mountPath: mountPaths.length > 0 ? mountPaths[0] : "", 
                gateways: certGateways,
                virtualServices: certVirtualServices
              }
            ])
          })

          this.onStreamOutput  && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
