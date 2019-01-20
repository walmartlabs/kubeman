import {K8sClient} from './k8sClient'
import K8sFunctions, { GetItemsFunction } from '../k8s/k8sFunctions';

export default class IstioFunctions {

  private static extractResource(result: any, ...specKeys) {
    const yaml = specKeys.includes("yaml")
    const getResource = (obj) => {
      const resource = {
        ...K8sFunctions.extractMetadata(obj)
      }
      specKeys.forEach(key => obj.spec[key] && (resource[key] = obj.spec[key]))
      if(yaml) {
        delete obj.metadata["creationTimestamp"]
        delete obj.metadata["generation"]
        delete obj.metadata["resourceVersion"]
        delete obj.metadata["selfLink"]
        delete obj.metadata["uid"]
        resource["yaml"] = obj
      }
      return resource
    }
    if(result && result.body) {
      if(result.body.items) {
        return result.body.items.map(getResource)
      } else {
        return getResource(result.body)
      }
    }
    return []
  }

  static listAllGateways = async (k8sClient: K8sClient, yaml: boolean = true) => {
    const keys = ["selector", "servers"]
    yaml && keys.push("yaml")
    return IstioFunctions.extractResource(await k8sClient.istio.gateways.get(), ...keys) as any[]
  }

  static listAllIngressGateways = async (k8sClient: K8sClient, yaml: boolean = true) => {
    return (await IstioFunctions.listAllGateways(k8sClient, yaml) as any[])
            .filter(gateway => gateway.selector.istio === 'ingressgateway')
  }

  static listAllEgressGateways = async (k8sClient: K8sClient, yaml: boolean = true) => {
    return (await IstioFunctions.listAllGateways(k8sClient, yaml) as any[])
            .filter(gateway => gateway.selector.istio === 'egressgateway')
  }

  static getGatewaysForVirtualServices = async (virtualServices: any[], k8sClient: K8sClient, yaml: boolean = false) => {
    const allGateways = await IstioFunctions.listAllGateways(k8sClient, yaml)
    return allGateways.filter(g => 
      virtualServices.filter(vs => vs.gateways)
      .filter(vs => 
        vs.gateways.filter(vsg => vsg.includes(g.name)).length > 0
      ).length > 0
    )
  }

  static listAllVirtualServices = async (k8sClient: K8sClient, yaml: boolean = true) => {
    const keys = ["gateways", "hosts", "http", "tls", "tcp"]
    yaml && keys.push("yaml")
    return IstioFunctions.extractResource(await k8sClient.istio.virtualservices.get(), ...keys) as any[]
  }

  static listAllIngressVirtualServices = async (k8sClient: K8sClient, yaml: boolean = true) => {
    const ingressGateways = (await IstioFunctions.listAllIngressGateways(k8sClient))
                            .map(g => g.name)
    return (await IstioFunctions.listAllVirtualServices(k8sClient, yaml))
            .filter(v => v.gateways && v.gateways.filter(g => 
              ingressGateways.filter(ig => g.includes(ig)).length > 0).length > 0)
  }

  static listAllEgressVirtualServices = async (k8sClient: K8sClient, yaml: boolean = true) => {
    const egressGateways = (await IstioFunctions.listAllEgressGateways(k8sClient))
                            .map(g => g.name)
    return (await IstioFunctions.listAllVirtualServices(k8sClient, yaml))
            .filter(v => v.gateways && v.gateways.filter(g => egressGateways.includes(g)).length > 0)
  }

  static getNamespaceVirtualServices = async (cluster: string, namespace: string, k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.namespaces(namespace).virtualservices.get(),
                            "gateways", "hosts", "http", "tls", "tcp") as any[]
  }

  static filterVirtualServicesByRouteForService(virtualServices: any[], 
                      service: string, namespace: string, routeType: string) {
    const serviceHost = service + "." + namespace
    return virtualServices.filter(vs => vs[routeType] ?
      vs[routeType].filter(routeType => 
        routeType.route.filter(route => {
          const textToMatch = vs.namespace === namespace ? service : serviceHost
          return route.destination.host.includes(textToMatch)
                && (route.destination.host.length === textToMatch.length ||
                    route.destination.host.includes(textToMatch+"."))
        }).length > 0
      ).length > 0
      : false
    )
  }

  static getVirtualServicesForService = async (service: string, namespace: string, k8sClient: K8sClient) => {
    const serviceHost = service + "." + namespace
    const allVirtualServices = await IstioFunctions.listAllVirtualServices(k8sClient)
    let httpVirtualServices = IstioFunctions.filterVirtualServicesByRouteForService(
                                allVirtualServices, service, namespace, 'http')
    let tlsVirtualServices = IstioFunctions.filterVirtualServicesByRouteForService(
                                allVirtualServices, service, namespace, 'tls')
    let tcpVirtualServices = IstioFunctions.filterVirtualServicesByRouteForService(
                                allVirtualServices, service, namespace, 'tcp')
    const virtualServices : {[key: string]: any} = {}
    httpVirtualServices.forEach(vs => virtualServices[vs.name]=vs)
    tlsVirtualServices.forEach(vs => virtualServices[vs.name]=vs)
    tcpVirtualServices.forEach(vs => virtualServices[vs.name]=vs)
    return Object.values(virtualServices)
  }

  static listAllDestinationRules = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.destinationrules.get(), "yaml") as any[]
  }

  static getServiceDestinationRules = async (service: string, namespace: string, k8sClient: K8sClient) => {
    const allDestinationRules = IstioFunctions.extractResource(
          await k8sClient.istio.destinationrules.get(), "host", "trafficPolicy", "subsets") as any[]
    let applicableDestinationRules: any[] = []
    applicableDestinationRules = applicableDestinationRules.concat(
          allDestinationRules.filter(r => r.host.includes(service)))
    applicableDestinationRules = applicableDestinationRules.concat(
      allDestinationRules.filter(r => 
        (r.host === "*."+namespace || r.host.includes("*."+namespace+"."))
        || r.host.includes("*.local")))
    return applicableDestinationRules
  }

  static listAllServiceEntries = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.serviceentries.get(),
                      "hosts", "addresses", "ports", "location", "resolution", "endpoints", "yaml") as any[]
  }

  static listAllEnvoyFilters = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.envoyfilters.get(),
                                "workloadLabels", "filters", "yaml") as any[]
  }

  static listAllPolicies = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.policies.get(),
            "targets", "peers", "peerIsOptional", "origins", 
            "originIsOptional", "principalBinding", "yaml") as any[]
  }

  static getServicePolicies = async (service: string, k8sClient: K8sClient) => {
    const allPolicies = await IstioFunctions.listAllPolicies(k8sClient)
    return allPolicies.filter(p => p.targets && p.targets.filter(target => 
      target.name === service || target.name.includes(service+".")).length > 0)
  }

  static listAllMeshPolicies = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.meshpolicies.get(),
            "targets", "peers", "peerIsOptional", "origins", 
            "originIsOptional", "principalBinding", "yaml") as any[]
  }

  static listAllRules = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.rules.get(),
                                "match", "actions", "yaml") as any[]
  }

  static listAnyResource = async (resource: string, k8sClient: K8sClient) => {
    if(k8sClient.istio[resource]) {
      return IstioFunctions.extractResource(await k8sClient.istio[resource].get(), "yaml") as any[]
    }
    return []
  }

  static getMtlsStatus = async (k8sClient: K8sClient) => {
    let isGlobalMtlsEnabled: boolean = false
    const namespacesWithDefaultMtls: string[] = []
    const servicesWithMtlsPolicies: any[] = []

    const defaultMeshPolicy = (await IstioFunctions.listAllMeshPolicies(k8sClient))
            .filter(policy => policy.name === 'default')
    if(defaultMeshPolicy && defaultMeshPolicy.length > 0) {
      isGlobalMtlsEnabled = true
    }

    const policies = await IstioFunctions.listAllPolicies(k8sClient)
    const namespaceDefaultPolicies = policies && policies.length ? 
                policies.filter(policy => /*policy.name === 'default' && */
                      policy.peers && policy.peers.filter(peer => peer.mtls).length > 0
                      && !policy.targets) : []
    namespaceDefaultPolicies.forEach(policy => namespacesWithDefaultMtls.push(
                            policy.namespace + ": " + 
                            policy.peers.filter(peer => peer.mtls)[0].mtls.mode))
    const serviceMtlsPolicies = policies && policies.length ? 
                policies.filter(policy => /*policy.name !== 'default' && */
                      policy.peers && policy.peers.filter(peer => peer.mtls).length > 0
                      && policy.targets) : []
    serviceMtlsPolicies.forEach(policy => policy.targets.forEach(target => 
      servicesWithMtlsPolicies.push({
            name: target.name,
            namespace: policy.namespace,
            mode: policy.peers.filter(peer => peer.mtls)[0].mtls.mode
          })))

    return {
      isGlobalMtlsEnabled,
      namespacesWithDefaultMtls,
      servicesWithMtlsPolicies
    }
  }

  static getServiceMtlsStatuses = async (k8sClient: K8sClient, service?: string, namespace?: string) => {
    const policies = await IstioFunctions.listAllPolicies(k8sClient)
    const serviceMtlsPolicies = policies && policies.length ? 
                policies.filter(policy => /*policy.name !== 'default' && */
                      policy.peers && policy.peers.filter(peer => peer.mtls).length > 0
                      && ((policy.targets && policy.targets.length > 0) 
                          || policy.name === 'default')) : []
    const pilotPods = await K8sFunctions.getPodsByLabels("istio-system", "istio=pilot", k8sClient)
    let serviceMtlsStatuses: any
    try {
      let serviceFqdn = service
      serviceFqdn && namespace && (serviceFqdn += "."+namespace)
      serviceFqdn && (serviceFqdn += ".svc.cluster.local")

      serviceMtlsStatuses = await K8sFunctions.podExec("istio-system", pilotPods[0].name, "discovery", k8sClient, 
                         ["curl", "-s", "localhost:8080/debug/authenticationz"
                            + (serviceFqdn ? "?proxyID="+serviceFqdn : "")])
      if(serviceMtlsStatuses && serviceMtlsStatuses.length > 0) {
        serviceMtlsStatuses = JSON.parse(serviceMtlsStatuses)
        serviceMtlsStatuses = serviceMtlsStatuses
          .filter(status => status.host)
          .map(status => {
            const pieces = status.host.split(".")
            const serviceName = pieces.length > 0 ? pieces[0] : ""
            const namespace = pieces.length > 1 ? pieces[1] : ""
            let serviceMtlsMode = undefined
            const servicePolicies = serviceMtlsPolicies.filter(policy => {
              const isDefaultPolicy = policy.name === 'default' && policy.namespace === namespace
              const isPolicyForService = 
              policy.targets && policy.targets.filter(target => 
                target.name === serviceName && 
                  (!target.ports || target.ports.length === 0 
                    || target.ports.filter(port => port.number === status.port).length > 0)).length > 0
              return isDefaultPolicy || isPolicyForService
            })
            if(servicePolicies && servicePolicies.length > 0) {
              const peers = servicePolicies[0].peers.filter(peer => peer.mtls)
              serviceMtlsMode = peers.length > 0 ? peers[0].mtls.mode : ""
            }
            if(status.TLS_conflict_status === 'CONFLICT' && serviceMtlsMode === 'PERMISSIVE') {
              status.TLS_conflict_status = 'Permitted'
            } else if(status.TLS_conflict_status === 'OK') {
              status.TLS_conflict_status = 'Good'
            }
            return {
              serviceName,
              namespace,
              port: status.port,
              policy: status.authentication_policy_name.split("/")[0],
              destinationRule: status.destination_rule_name.split("/")[0],
              serverProtocol: status.server_protocol,
              clientProtocol: status.client_protocol,
              serviceMtlsMode,
              status: status.TLS_conflict_status,
            }
          })
      } else {
        serviceMtlsStatuses = []
      }
    } 
    catch(err){
      console.log(err)
      serviceMtlsStatuses = []
    }
    return serviceMtlsStatuses
  }

  static async getIstioServiceDetails(labelSelector: string, k8sClient: K8sClient) {
    const services = await K8sFunctions.getServicesByLabels("istio-system", labelSelector, k8sClient)
    return services.map(service => {
      return {
        name: service.name,
        type: service.type,
        clusterIP: service.clusterIP,
        externalIPs: service.externalIPs,
        externalName: service.externalName,
        healthCheckNodePort: service.healthCheckNodePort,
        'loadBalancer.ingress': service.loadBalancer?service.loadBalancer.ingress:"",
        loadBalancerIP: service.loadBalancerIP,
        loadBalancerSourceRanges: service.loadBalancerSourceRanges,
        ports: service.ports.map(port => "["+port.name+", "+port.protocol+", "
                  +(port.nodePort?port.nodePort+"->":"")
                  +(port.port?port.port:"")
                  +(port.targetPort?"->"+port.targetPort:"")
                  +"]"),
        selector: service.selector,
    }})
  }

  static async getIstioServicePods(labelSelector: string, k8sClient: K8sClient, loadDetails: boolean = false) {
    const ingressPods = await K8sFunctions.getPodsByLabels("istio-system", labelSelector, k8sClient)
    return ingressPods.map(pod => {
      return {
        name: pod.name,
        podIP: pod.podIP,
        hostIP: pod.hostIP,
        startTime: pod.startTime,
        conditions: pod.conditions,
        podDetails: loadDetails ? pod : undefined
      }
    })
  }

  static async getIngressGatewayPods(k8sClient: K8sClient, loadDetails: boolean = false) {
    return IstioFunctions.getIstioServicePods("istio=ingressgateway", k8sClient, loadDetails)
  }

  static async getPilotPods(k8sClient: K8sClient, loadDetails: boolean = false) {
    return IstioFunctions.getIstioServicePods("istio=pilot", k8sClient, loadDetails)
  }

  static getIngressCertsFromPod = async (pod: string, k8sClient: K8sClient) => {
    let commandOutput = (await K8sFunctions.podExec("istio-system", pod, "istio-proxy", k8sClient, 
                                  ["curl", "-s", "127.0.0.1:15000/certs"])).trim()
    commandOutput = commandOutput.replace("}", "},")
    return JSON.parse("[" + commandOutput + "]").map(cert => cert.cert_chain)
  }

  static getIngressCerts = async (k8sClient: K8sClient) => {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return []
    }
    return IstioFunctions.getIngressCertsFromPod(ingressPods[0].name, k8sClient)
  }

  static async getIstioProxyConfigDump(k8sClient: K8sClient, namespace: string, pod: string, configType?: string) {
    try {
      const result = JSON.parse(await K8sFunctions.podExec(namespace, pod, "istio-proxy", k8sClient, 
                                  ["curl", "-s", "http://127.0.0.1:15000/config_dump"]))
      if(result.configs.clusters) {
        result.configs = Object.values(result.configs)
      }
      let configs = result.configs
      if(configType) {
        configs = configs.filter(c => c["@type"].includes(configType))
      }
      configs = configs.map(config => {
        if(configType) {
          return config[Object.keys(config).filter(key => key.includes("dynamic"))[0]]
        } else {
          return config
        }
      })
      return configType ? configs[0] : configs
    } catch(error) {
      console.log(error)
    }
    return []
  }

  static async getIstioProxyStats(k8sClient: K8sClient, namespace: string, pod: string) {
      return K8sFunctions.podExec(namespace, pod, "istio-proxy", k8sClient, 
                                  ["curl", "-s", "http://127.0.0.1:15000/stats"])
  }

  static async getIngressConfigDump(k8sClient: K8sClient, configType?: string) {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return []
    }
    return IstioFunctions.getIstioProxyConfigDump(k8sClient, "istio-system", ingressPods[0].name, configType)
  }

  static async getIngressGatwayStats(k8sClient: K8sClient) {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return ""
    }
    return IstioFunctions.getIstioProxyStats(k8sClient, "istio-system", ingressPods[0].name)
  }

  static async executeOnAnyPilotPod(k8sClient: K8sClient, command: string[]) {
    const pilotPods = await IstioFunctions.getPilotPods(k8sClient)
    return K8sFunctions.podExec("istio-system", pilotPods[0].name, "discovery", k8sClient, command)
  }

  static async getPilotEndpoints(k8sClient: K8sClient, service?: string, namespace?: string) {
    if(!k8sClient.istio) {
      return []
    }
    const result = await IstioFunctions.executeOnAnyPilotPod(k8sClient,
                                  ["curl", "-s", "localhost:8080/debug/edsz"])
    if(result) {
      let pilotEndpoints = JSON.parse(result) as any[]
      if(service && namespace) {
        const text = service + "." + namespace
        pilotEndpoints = pilotEndpoints.filter(e => e.clusterName.includes(text))
      }
      return pilotEndpoints
    }
    return []

  }

  static async getPilotMetrics(k8sClient: K8sClient) {
    if(!k8sClient.istio) {
      return undefined
    }
    return IstioFunctions.executeOnAnyPilotPod(k8sClient,
                                  ["curl", "-s", "localhost:8080/metrics"])
  }

  static async getPilotSidecarSyncStatus(k8sClient: K8sClient) {
    if(!k8sClient.istio) {
      return []
    }
    const result = await IstioFunctions.executeOnAnyPilotPod(k8sClient,
                                  ["curl", "-s", "localhost:8080/debug/syncz"])
    return result ? JSON.parse(result) as any[] : []
  }

  static async getPilotConfigDump(k8sClient: K8sClient, proxyID: string, configType?: string) {
    try {

      const result = JSON.parse(await IstioFunctions.executeOnAnyPilotPod(k8sClient,
                                    ["curl", "-s", "localhost:8080/debug/config_dump?proxyID="+proxyID]))
      let configs = result.configs
      if(configType) {
        configs = configs.filter(c => c["@type"].includes(configType))
      }
      configs = configs.map(config => {
        if(configType) {
          return config[Object.keys(config).filter(key => key.includes("dynamic"))[0]]
        } else {
          return config
        }
      })
      return configType ? configs[0] : configs
    } catch(error) {
      console.log(error)
    }
    return []
  }

  static getAllSidecars = async (k8sClient: K8sClient) => {
    if(!k8sClient.istio) {
      return []
    }
    const result = await IstioFunctions.executeOnAnyPilotPod(k8sClient,
                                  ["curl", "-s", "localhost:8080/debug/adsz"])
    if(result) {
      const pilotCDSData = JSON.parse(result) as any[]
      const sidecars = pilotCDSData.filter(cds => cds.node.startsWith("sidecar~"))
                          .map(cds => cds.node.split("~"))
                          .map(pieces => {
                            const podAndNamespace = pieces[2].split(".")
                            return {
                              ip: pieces[1],
                              pod: podAndNamespace[0],
                              namespace: podAndNamespace[1]
                            }
                          })
      return sidecars
    }
    return []
  }

  static getNamespaceSidecars = async (namespace: string, k8sClient: K8sClient) => {
    const sidecars = await IstioFunctions.getAllSidecars(k8sClient)
    return sidecars.filter(s => s.namespace === namespace)
  }
}
