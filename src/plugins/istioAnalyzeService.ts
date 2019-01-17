import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import K8sPluginHelper, {ItemSelection} from '../k8s/k8sPluginHelper'
import { ContainerInfo, PodDetails, ServiceDetails } from '../k8s/k8sObjectTypes';
import { K8sClient } from '../k8s/k8sClient';
import JsonUtil from '../util/jsonUtil';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "More Istio Recipes",
  actions: [
    {
      name: "Analyze Service",
      order: 22,
      
      async choose(actionContext) {
        if(actionContext.getNamespaces().length === 0) {
          this.onOutput && this.onOutput(["No Namespace selected"], ActionOutputStyle.Text)
        } else {
          await K8sPluginHelper.prepareChoices(actionContext, K8sFunctions.getNamespaceServices, "Services", 1, 1, "name")
        }
      },

      async act(actionContext) {
        const selections: ItemSelection[] = await K8sPluginHelper.getSelections(actionContext, "name")
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No service selected"]], ActionOutputStyle.Text)
          return
        }
        const service = selections[0].item
        const namespace = selections[0].namespace
        const cluster = actionContext.getClusters()
                            .filter(c => c.name === selections[0].cluster)[0]
        this.onOutput && this.onOutput([["Service: " + service.name 
                              + ", Namespace: " + namespace + ", Cluster: " + cluster.name]], ActionOutputStyle.Table)
        this.onStreamOutput && this.onStreamOutput([[">Service Details"], [service]])
        this.showOutputLoading && this.showOutputLoading(true)

        const podsAndContainers = await this.outputPodsAndContainers(service, namespace, cluster.k8sClient)
        if(cluster.hasIstio) {
          const vsGateways = await this.outputVirtualServicesAndGateways(service, namespace, cluster.k8sClient)
          const ingressPods = await IstioFunctions.getIngressGatewayPods(cluster.k8sClient, true)

          await this.outputRoutingAnalysis(service, podsAndContainers, vsGateways, ingressPods, cluster.k8sClient)

          if(vsGateways.ingressCerts.length > 0) {
            await this.outputCertsStatus(vsGateways.ingressCerts, ingressPods, cluster.k8sClient)
          }

          await this.outputPolicies(service, cluster.k8sClient)
          await this.outputDestinationRules(service, namespace, cluster.k8sClient)
          await this.outputServiceMtlsStatus(service, namespace, cluster.k8sClient)
        } else {
          this.onStreamOutput && this.onStreamOutput([[">>Istio not installed"]])
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },

      async outputPodsAndContainers(service: ServiceDetails, namespace: string, k8sClient: K8sClient) {
        const podsAndContainers = await K8sFunctions.getPodsAndContainersForService(
                                        namespace, service, k8sClient, true)
        const containers = (podsAndContainers.containers as ContainerInfo[]) || []
        const isSidecarPresent = containers.filter(c => c.name === "istio-proxy").length === 1
        this.onStreamOutput && this.onStreamOutput([[">Envoy Sidecar Status"],
                                [isSidecarPresent ? "Sidecar Proxy Present" : "Sidecar Proxy Not Deployed"]]) 
        this.onStreamOutput && this.onStreamOutput([[">Service Containers"]])
        if(containers.length > 0) {
          containers.map(c => this.onStreamOutput && this.onStreamOutput([[">>"+c.name],[c]]))
        } else {
          this.onStreamOutput && this.onStreamOutput([["No containers"]])
        }

        const pods = podsAndContainers.pods as PodDetails[]
        this.onStreamOutput && this.onStreamOutput([[">Service Pods"]]) 
        if(pods && pods.length > 0) {
          pods.map(pod => this.onStreamOutput && this.onStreamOutput([[">>"+pod.name],[pod]]))
        } else {
          this.onStreamOutput && this.onStreamOutput([["No pods"]])
        }
        return podsAndContainers
      },

      async outputVirtualServicesAndGateways(service: ServiceDetails, namespace: string, k8sClient: K8sClient) {
        const virtualServices = await IstioFunctions.getVirtualServicesForService(service.name, namespace, k8sClient)
        const gateways = await IstioFunctions.getGatewaysForVirtualServices(virtualServices, k8sClient)

        this.onStreamOutput && this.onStreamOutput([[">Referencing VirtualServices + Gateways"]]) 
        virtualServices.length === 0 && 
          this.onStreamOutput && this.onStreamOutput([["No VirtualServices/Gateways"]])
        
        const ingressCerts: {[key: string] : string} = {}
        virtualServices.forEach(vs => {
          const vsGateways = gateways.map(g => {
            const matchingServers = g.servers
            .filter(server => server.port && server.port.protocol === (vs.http ? 'HTTP' : vs.tls ? 'HTTPS' : 'TCP'))
            .filter(server => server.hosts && 
              server.hosts.filter(host => host.includes('*') || vs.hosts.includes(host)).length > 0)
            if(matchingServers.length > 0) {
              if(g.selector && g.selector.istio && g.selector.istio === 'ingressgateway') {
                matchingServers.filter(s => s.tls && s.tls.serverCertificate && s.tls.privateKey)
                  .forEach(s => ingressCerts[s.tls.privateKey]=s.tls.serverCertificate)
              }
              return {
                name: g.name,
                namespace: g.namespace,
                "servers (showing matching hosts)": matchingServers
              }
            } else {
              return {}
            }
          }).filter(g => g.name)

          const gateway = vsGateways.length > 0 ? vsGateways[0] : "No Gateway"
          this.onStreamOutput && this.onStreamOutput([
            [">>VirtualService: " + vs.name + ", " + (gateway['name'] ? "Gateway: " + gateway['name'] : gateway)],
            [[vs, gateway]]
          ])
        })
        return {
          virtualServices,
          gateways,
          ingressCerts: Object.keys(ingressCerts).map(key => [key, ingressCerts[key]])
        }
      },

      async outputRoutingAnalysis(service: ServiceDetails, podsAndContainers: any, vsGateways: any, ingressPods: any[], k8sClient: K8sClient) {
        this.onStreamOutput && this.onStreamOutput([[">Routing Analysis"]])

        const containerPorts = podsAndContainers.containers ? 
                _.flatten((podsAndContainers.containers as ContainerInfo[])
                    .map(c => c.ports ? c.ports.map(p => p.containerPort) : [])) : []
        const serviceTargetPorts = service.ports.map(p => p.targetPort)
        const invalidServiceTargetPorts = serviceTargetPorts.filter(p => !containerPorts.includes(p))
        this.onStreamOutput && this.onStreamOutput([[
          invalidServiceTargetPorts.length > 0 ?
            "Found service target ports that are mismatched and don't exist as container ports: " + invalidServiceTargetPorts.join(", ")
            : "Service target ports correctly match container ports."
        ]])

        const servicePorts = service.ports.map(p => p.port)
        const vsDestinationPorts = 
          _.flatten(
            _.flatten(vsGateways.virtualServices.filter(vs => vs.http).map(vs => vs.http)
                      .concat(vsGateways.virtualServices.filter(vs => vs.tls).map(vs => vs.tls))
                      .concat(vsGateways.virtualServices.filter(vs => vs.tcp).map(vs => vs.tcp)))
            .filter(routeDetails => routeDetails.route)
            .map(routeDetails => routeDetails.route)
          )
          .filter(route => route.destination && route.destination.port)
          .map(route => route.destination.port.number)
        const invalidVSDestPorts = vsDestinationPorts.filter(p => !servicePorts.includes(p))
        this.onStreamOutput && this.onStreamOutput([[
          invalidVSDestPorts.length > 0 ?
            "Found VirtualService destination ports that are mismatched and don't exist as service ports: " + invalidVSDestPorts.join(", ")
            : "VirtualService destination ports correctly match service ports."
        ]])

        if(ingressPods && ingressPods.length > 0 && podsAndContainers.pods && podsAndContainers.pods.length > 0) {
          try {
            const ingressProxyContainer = ingressPods[0].podDetails ? ingressPods[0].podDetails.containers[0].name : "istio-proxy"
            const servicePods = podsAndContainers.pods as PodDetails[]
            for(const pod of servicePods) {
              if(pod.podIP) {
                const result = await K8sFunctions.podExec("istio-system", ingressPods[0].name, 
                                    ingressProxyContainer, k8sClient, ["ping", "-c 2", pod.podIP])
                const pingSuccess = result.includes("2 received")
                this.onStreamOutput && this.onStreamOutput([[
                  "Pod " + pod.name + (pingSuccess ? " is Reachable" : ": is Unreachable") + " from ingress gateway"
                ]])
              }
            }
          } catch(error) {
            console.log(error)
          }
        }
      },

      async outputCertsStatus(ingressCerts: [[string,  string]], ingressPods: any[], k8sClient: K8sClient) {
        this.onStreamOutput && this.onStreamOutput([[">Service Ingress Certs"], [JsonUtil.convertObjectToArray(ingressCerts)]])

        this.onStreamOutput && this.onStreamOutput([[">Service Ingress Certs Deployment Status"]])
        const certPaths: string[] = []
        ingressCerts.forEach(pair => {
          certPaths.push(pair[0].trim())
          certPaths.push(pair[1].trim())
        })
        for(const pod of ingressPods) {
          const container = pod.podDetails ? pod.podDetails.containers[0].name : "istio-proxy"
          this.onStreamOutput && this.onStreamOutput([[">>Pod: " + pod.name]])
          try {
            const certsLoadedOnIngress = await IstioFunctions.getIngressCertsFromPod(pod.name, k8sClient)
            for(const path of certPaths) {
              const result = (await K8sFunctions.podExec("istio-system", pod.name, container, k8sClient, ["ls", path])).trim()
              const isPathFound = path === result
              const certLoadedInfo = certsLoadedOnIngress.filter(info => info.includes(path))
              const isPrivateKey = path.indexOf(".key") > 0
              const certStatusOutput = {}
              certStatusOutput[path] = []
              certStatusOutput[path].push((isPathFound ? "Present " : "NOT present ") + "on the pod filesystem")
              if(!isPrivateKey) {
                certStatusOutput[path].push("Loaded on pod >> " + 
                    (certLoadedInfo.length > 0 ? certLoadedInfo[0] : "NOT loaded on ingress gateway pod"))
              }
              this.onStreamOutput && this.onStreamOutput([[certStatusOutput]])
            }
          } catch(error) {
            this.onStreamOutput && this.onStreamOutput([["Failed to check cert status due to error: " + error.message]])
          }
        }
      },

      async outputServiceMtlsStatus(service: ServiceDetails, namespace: string, k8sClient: K8sClient) {
        const mtlsStatuses = await IstioFunctions.getServiceMtlsStatuses(k8sClient, service.name, namespace)
        for(const mtlsStatus of mtlsStatuses) {
          const mtlsAccessStatus = await IstioPluginHelper.getServiceMtlsAccessStatus(namespace, service, mtlsStatus, k8sClient)
          mtlsStatus.access = mtlsAccessStatus.access
        }
        this.onStreamOutput && this.onStreamOutput([[">Service MTLS Status"], [mtlsStatuses]])
      },

      async outputPolicies(service: ServiceDetails, k8sClient: K8sClient) {
        const policies = await IstioFunctions.getServicePolicies(service.name, k8sClient)
        this.onStreamOutput && this.onStreamOutput([[">Policies relevant to this service"], 
          [policies.length === 0 ? "No Policies" : policies]])
      },

      async outputDestinationRules(service: ServiceDetails, namespace: string, k8sClient: K8sClient) {
        const destinationRules = await IstioFunctions.getServiceDestinationRules(service.name, namespace, k8sClient)
        this.onStreamOutput && this.onStreamOutput([[">DestinationRules relevant to this service"], 
          [destinationRules.length === 0 ? "No DestinationRules" : destinationRules]])
      },

    }
  ]
}

export default plugin
