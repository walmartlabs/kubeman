import _ from 'lodash'
import {K8sClient} from './k8sClient'
import K8sFunctions from './k8sFunctions'
import EnvoyFunctions from './envoyFunctions'
import { ServiceDetails } from './k8sObjectTypes'
import {matchObjects, extractServiceFromFqdn, extractNamespaceFromFqdn, 
        getUniqueResources, FqdnMatcher, getUniqueResourcesByField} from '../util/matchUtil'

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
        vs.gateways.filter(vsg => vsg === g.name || vsg.includes(g.name+".")).length > 0
      ).length > 0
    )
  }

  static getGatewaysForFqdn = async (fqdn: string, k8sClient: K8sClient) => {
    FqdnMatcher.init(fqdn)
    return (await IstioFunctions.listAllGateways(k8sClient, true))
            .filter(g => g.servers.filter(server => 
              server.hosts.filter(host => FqdnMatcher.matchDomain(host)).length > 0
            ).length > 0)
  }

  static getGatewaysForPorts = async (ports: number[], k8sClient: K8sClient) => {
    const allGateways = await IstioFunctions.listAllGateways(k8sClient, false)
    return allGateways.filter(g => {
      const gatewayPorts = g.servers.map(s => s.port.number)
              .filter(p => ports.includes(p))
      if(gatewayPorts.length > 0) {
        g.gatewayPorts = gatewayPorts
        return true
      }
      return false
    })
  }

  static getNamespaceGateways = async (namespace: string, k8sClient: K8sClient) => {
    const allGateways = await IstioFunctions.listAllGateways(k8sClient, true)
    return allGateways.filter(g => g.namespace === namespace)
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
              ingressGateways.filter(ig => g === ig || g.includes(ig+".")).length > 0).length > 0)
  }

  static listAllEgressVirtualServices = async (k8sClient: K8sClient, yaml: boolean = true) => {
    const egressGateways = (await IstioFunctions.listAllEgressGateways(k8sClient))
                            .map(g => g.name)
    return (await IstioFunctions.listAllVirtualServices(k8sClient, yaml))
            .filter(v => v.gateways && v.gateways.filter(g => egressGateways.includes(g)).length > 0)
  }

  static getVirtualServices = async (cluster, namespace, k8sClient) => {
    if(k8sClient.istio) {
      const virtualServices = (namespace && namespace.length > 0) ?
                                await k8sClient.istio.namespaces(namespace).virtualservices.get()
                                : await k8sClient.istio.virtualservices.get()
      return IstioFunctions.extractResource(virtualServices,
                              "gateways", "hosts", "http", "tls", "tcp") as any[]
    } else {
      return []
    }
  }

  static filterVirtualServicesByRouteForService(virtualServices: any[], 
                      service: string, namespace: string, routeType: string) {
    FqdnMatcher.initWithService(service, namespace)
    return virtualServices.filter(vs => vs[routeType] ?
      vs[routeType].filter(routeType => 
        routeType.route.filter(route => FqdnMatcher.matchService(route.destination.host)
          && (vs.namespace === namespace || FqdnMatcher.matchNamespace(route.destination.host))
        ).length > 0
      ).length > 0
      : false
    )
  }

  static getVirtualServicesForService = async (service: string, namespace: string, k8sClient: K8sClient) => {
    const allVirtualServices = await IstioFunctions.listAllVirtualServices(k8sClient)
    const httpVirtualServices = IstioFunctions.filterVirtualServicesByRouteForService(
                                allVirtualServices, service, namespace, 'http')
    const tlsVirtualServices = IstioFunctions.filterVirtualServicesByRouteForService(
                                allVirtualServices, service, namespace, 'tls')
    const tcpVirtualServices = IstioFunctions.filterVirtualServicesByRouteForService(
                                allVirtualServices, service, namespace, 'tcp')
    return getUniqueResources(httpVirtualServices, tlsVirtualServices, tcpVirtualServices)
  }

  static filterVirtualServicesByRouteForFqdn(virtualServices: any[], fqdn: string, routeType: string) {
    return virtualServices.filter(vs => vs[routeType] ?
      vs[routeType].filter(routeType => 
        routeType.route && routeType.route.filter(route => 
          FqdnMatcher.matchDomain(route.destination.host)).length > 0
      ).length > 0
      : false
    )
  }

  static filterVirtualServicesByHostsForFqdn(virtualServices: any[], fqdn: string) {
    return virtualServices.filter(vs => vs.hosts.filter(host =>
            FqdnMatcher.matchDomain(host)).length > 0)
  }

  static getVirtualServicesForFqdn = async (fqdn: string, k8sClient: K8sClient) => {
    FqdnMatcher.init(fqdn)
    const allVirtualServices = await IstioFunctions.listAllVirtualServices(k8sClient)
    const vsMatchingHosts = IstioFunctions.filterVirtualServicesByHostsForFqdn(allVirtualServices, fqdn)
    const httpVirtualServices = IstioFunctions.filterVirtualServicesByRouteForFqdn(
                                allVirtualServices, fqdn, 'http')
    const tlsVirtualServices = IstioFunctions.filterVirtualServicesByRouteForFqdn(
                                allVirtualServices, fqdn, 'tls')
    const tcpVirtualServices = IstioFunctions.filterVirtualServicesByRouteForFqdn(
                                allVirtualServices, fqdn, 'tcp')
    return getUniqueResources(vsMatchingHosts, httpVirtualServices, tlsVirtualServices, tcpVirtualServices)
  }

  static getVirtualServicesForPorts = async (ports: number[], k8sClient: K8sClient) => {
    const portsOutput = {}
    const matchRoutePorts = (port, routeConfigs) => {
      const matchPorts = _.flatten(routeConfigs.map(rc => rc.match ? rc.match.map(m => m.port) : [])).filter(p => p)
      const matchesMatchPort = matchPorts.includes(port)
      const destinationPorts = _.flatten(routeConfigs.map(rc => rc.route ? rc.route.map(r => 
              r.destination && r.destination.port && r.destination.port.number) : [])).filter(p => p)
      const matchesDestPort = destinationPorts.includes(port)

      if(matchesDestPort) {
        portsOutput[port].matchPorts = _.uniqBy(portsOutput[port].matchPorts.concat(matchPorts))
        if(!portsOutput[port].destinationPorts.includes(port)) {
          portsOutput[port].destinationPorts.push(port)
        }
      }
      if(matchesMatchPort) {
        portsOutput[port].destinationPorts = _.uniqBy(portsOutput[port].destinationPorts.concat(destinationPorts))
        if(!portsOutput[port].matchPorts.includes(port)) {
          portsOutput[port].matchPorts.push(port)
        }
      }
      return matchesMatchPort || matchesDestPort
    }

    const allVirtualServices = await IstioFunctions.listAllVirtualServices(k8sClient, false)
    ports.forEach(port => {
      portsOutput[port] = {matchPorts: [], destinationPorts: [], vs: []}
      portsOutput[port].vs = allVirtualServices.filter(vs => {
        const matchHttp = vs.http && matchRoutePorts(port, vs.http)
        const matchTls = vs.tls && matchRoutePorts(port, vs.tls)
        const matchTcp = vs.tcp && matchRoutePorts(port, vs.tcp)
        return matchHttp || matchTls || matchTcp
      })
    })
    return portsOutput
  }

  static getNamespaceVirtualServices = async (namespace: string, k8sClient: K8sClient) => {
    const allVirtualServices = await IstioFunctions.listAllVirtualServices(k8sClient, true)
    return allVirtualServices.filter(vs => vs.namespace === namespace)
  }

  static listAllSidecarResources = async (k8sClient: K8sClient) => {
    if(k8sClient.istio.sidecars) {
      return IstioFunctions.extractResource(await k8sClient.istio.sidecars.get(), 
                      "workloadSelector", "ingress", "egress", "yaml") as any[]
    } else {
      return []
    }
  }

  static getNamespaceSidecarResources = async (namespace: string, k8sClient: K8sClient) => {
    if(k8sClient.istio.sidecars) {
      return (IstioFunctions.extractResource(await k8sClient.istio.sidecars.get(), 
                      "workloadSelector", "ingress", "egress", "yaml") as any[])
            .filter(sc => sc.namespace === namespace)
    } else {
      return []
    }
  }

  static getServiceEgressSidecarResources = async (service: ServiceDetails, k8sClient: K8sClient) => {
    const allSidecarResources = await IstioFunctions.listAllSidecarResources(k8sClient)
    const nsSidecarResources = allSidecarResources.filter(sc => sc.namespace === service.namespace)
    const serviceSidecarResources = nsSidecarResources.filter(sc => 
      sc.workloadSelector && sc.workloadSelector.labels 
      && matchObjects(sc.workloadSelector.labels, service.selector))
    if(serviceSidecarResources.length > 0) {
      return serviceSidecarResources
    } else {
      return nsSidecarResources.filter(sc => !sc.workloadSelector)
    }
  }

  static matchSidecarEgressHost = (sidecar, matchTwoStars) => {
    return sidecar.egress && sidecar.egress.filter(e => e.hosts && 
      e.hosts.filter(host => {
        const hostParts = host.split("/")
        const hostService = extractServiceFromFqdn(hostParts[1])
        const hostServiceNamespace = extractNamespaceFromFqdn(hostParts[1])
        if(FqdnMatcher.isStar) {
          return hostParts[0].includes("*") || hostParts[1].includes("*")
        } else if(matchTwoStars || !(hostParts[0] === "*" && hostParts[1] === "*")) {
          return (hostParts[0] === "*" || FqdnMatcher.matchNamespace(hostParts[0]))
                  && (hostParts[1] === "*" || FqdnMatcher.matchService(hostService)
                          && FqdnMatcher.matchNamespace(hostServiceNamespace))
        }
      }).length > 0
    ).length > 0
  }

  static getServiceIncomingSidecarResources = async (service: ServiceDetails, k8sClient: K8sClient) => {
    FqdnMatcher.initWithService(service.name, service.namespace)
    const allSidecarResources = await IstioFunctions.listAllSidecarResources(k8sClient)
    return allSidecarResources.filter(sc => IstioFunctions.matchSidecarEgressHost(sc, true))
  }

  static getSidecarResourcesForFqdn = async (fqdn: string, k8sClient: K8sClient) => {
    FqdnMatcher.init(fqdn)
    const allSidecarResources = await IstioFunctions.listAllSidecarResources(k8sClient)
    return allSidecarResources.filter(sc => 
      FqdnMatcher.matchNamespace(sc.namespace) || IstioFunctions.matchSidecarEgressHost(sc, false)
    )
  }

  static listAllDestinationRules = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.destinationrules.get(), "yaml") as any[]
  }

  static extractDestinationRules(result) {
    return IstioFunctions.extractResource(result, "host", "trafficPolicy", "subsets", "exportTo") as any[]
  }

  static getServiceDestinationRules = async (service: ServiceDetails, k8sClient: K8sClient) => {
    FqdnMatcher.initWithService(service.name, service.namespace)
    const allDestinationRules = IstioFunctions.extractDestinationRules(await k8sClient.istio.destinationrules.get())
    const applicableDestinationRules = allDestinationRules.filter(r => FqdnMatcher.matchHost(r.host))
    return applicableDestinationRules
  }

  static getClientNamespaceDestinationRules = async (namespace: string, k8sClient: K8sClient) => {
    return (IstioFunctions.extractDestinationRules(await k8sClient.istio.destinationrules.get()))
            .filter(dr => dr.namespace === namespace)
  }

  static getNamespaceDestinationRules = async (namespace: string, k8sClient: K8sClient) => {
    return (await IstioFunctions.listAllDestinationRules(k8sClient))
            .filter(dr => dr.namespace === namespace)
  }

  static getDestinationRulesForFqdn = async (fqdn: string, k8sClient: K8sClient) => {
    FqdnMatcher.init(fqdn)
    return (await IstioFunctions.listAllDestinationRules(k8sClient))
            .filter(dr => FqdnMatcher.matchDomain(dr.yaml.spec.host))
  }

  static listAllServiceEntries = async (k8sClient: K8sClient, yaml: boolean = true) => {
    const fields = ["hosts", "addresses", "ports", "location", "resolution", "endpoints"]
    yaml && fields.push("yaml")
    return IstioFunctions.extractResource(await k8sClient.istio.serviceentries.get(), ...fields) as any[]
  }

  static getNamespaceServiceEntries = async (namespace: string, k8sClient: K8sClient) => {
    return (await IstioFunctions.listAllServiceEntries(k8sClient))
            .filter(se => se.namespace === namespace)
  }

  static getServiceServiceEntries = async (service: ServiceDetails, k8sClient: K8sClient) => {
    FqdnMatcher.initWithService(service.name, service.namespace)
    const allServiceEntries = await IstioFunctions.listAllServiceEntries(k8sClient, false)
    return allServiceEntries.filter(se => 
      se.hosts && se.hosts.filter(host => FqdnMatcher.matchHost(host)).length > 0
      || se.endpoints && se.endpoints.filter(e => FqdnMatcher.matchHost(e.address)).length > 0
    )
  }

  static getServiceEntriesForFqdn = async (fqdn: string, k8sClient: K8sClient) => {
    FqdnMatcher.init(fqdn)
    return (await IstioFunctions.listAllServiceEntries(k8sClient, true))
      .filter(se =>
        se.hosts && se.hosts.filter(host => FqdnMatcher.matchDomain(host)).length > 0
        || se.endpoints && se.endpoints.filter(e => FqdnMatcher.matchDomain(e.address)).length > 0)
  }

  static listAllEnvoyFilters = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.envoyfilters.get(),
                                "workloadLabels", "filters", "yaml") as any[]
  }

  static listAllPolicies = async (k8sClient: K8sClient, yaml: boolean = true) => {
    const fields = ["targets", "peers", "peerIsOptional", "origins", 
                    "originIsOptional", "principalBinding"]
    yaml && fields.push("yaml")
    return IstioFunctions.extractResource(await k8sClient.istio.policies.get(), ...fields) as any[]
  }

  static getServicePolicies = async (service: ServiceDetails, k8sClient: K8sClient) => {
    const allPolicies = await IstioFunctions.listAllPolicies(k8sClient, false)
    return allPolicies.filter(p => 
      (p.name === "default" && p.namespace === service.namespace && !p.targets)
      || 
      (p.targets && p.targets.filter(target => 
          target.name === service.name || target.name.includes(service+".")).length > 0)
    )
  }

  static getNamespacePolicies = async (namespace: string, k8sClient: K8sClient) => {
    return (await IstioFunctions.listAllPolicies(k8sClient, true))
            .filter(p => p.namespace === namespace)
  }

  static getPoliciesForFqdn = async (fqdn: string, k8sClient: K8sClient) => {
    FqdnMatcher.init(fqdn)
    return (await IstioFunctions.listAllPolicies(k8sClient, true))
            .filter(p => FqdnMatcher.matchNamespace(p.namespace) &&
              (!p.targets || p.targets.filter(t => FqdnMatcher.matchService(t.name)).length > 0))
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

  static getNamespaceRules = async (namespace: string, k8sClient: K8sClient) => {
    const allRules = await IstioFunctions.listAllRules(k8sClient)
    return allRules.filter(r => r.namespace === namespace)
  }

  static listAnyResource = async (resource: string, k8sClient: K8sClient) => {
    if(k8sClient.crds[resource]) {
      return IstioFunctions.extractResource(await k8sClient.crds[resource].get(), "yaml") as any[]
    }
    return []
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
        yaml: service.yaml,
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
    return EnvoyFunctions.getEnvoyLoadedCerts(k8sClient, "istio-system", pod, "istio-proxy")
  }

  static getIngressCerts = async (k8sClient: K8sClient) => {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return []
    }
    return IstioFunctions.getIngressCertsFromPod(ingressPods[0].name, k8sClient)
  }

  static async getIngressListenerPorts(k8sClient: K8sClient) {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return []
    }
    const ingressPodListenersMap = {}
    for(const ingressPod of ingressPods) {
      ingressPodListenersMap[ingressPod.name] = await EnvoyFunctions.getEnvoyListenerPorts(k8sClient, "istio-system", ingressPod.name, "istio-proxy")
    }
    return ingressPodListenersMap
  }

  static async getIngressGatewayEnvoyBootstrapConfig(k8sClient: K8sClient) {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return []
    }
    return EnvoyFunctions.getEnvoyBootstrapConfig(k8sClient, "istio-system", ingressPods[0].name, "istio-proxy")
  }
  
  static async getIngressGatewayEnvoyConfigs(configType: string, k8sClient: K8sClient) {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return []
    }
    if(configType.includes("Cluster")) {
      return EnvoyFunctions.getEnvoyClusters(k8sClient, "istio-system", ingressPods[0].name, "istio-proxy")
    }
    if(configType.includes("Listener")) {
      return EnvoyFunctions.gettEnvoyListeners(k8sClient, "istio-system", ingressPods[0].name, "istio-proxy")
    }
    if(configType.includes("Route")) {
      return EnvoyFunctions.gettEnvoyRoutes(k8sClient, "istio-system", ingressPods[0].name, "istio-proxy")
    }
    return []
  }
  
  static async getIngressGatewayEnvoyClusters(k8sClient: K8sClient) {
    return IstioFunctions.getIngressGatewayEnvoyConfigs("Clusters", k8sClient)
  }
  
  static async getIngressGatewayEnvoyListeners(k8sClient: K8sClient) {
    return IstioFunctions.getIngressGatewayEnvoyConfigs("Listeners", k8sClient)
  }
  
  static async getIngressGatewayEnvoyRoutes(k8sClient: K8sClient) {
    return IstioFunctions.getIngressGatewayEnvoyConfigs("Routes", k8sClient)
  }
  
  static async getAllIngressGatewayEnvoyConfigs(k8sClient: K8sClient) {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return {}
    }
    return EnvoyFunctions.getAllEnvoyConfigs(k8sClient, "istio-system", ingressPods[0].name, "istio-proxy")
  }

  static async getIngressGatwayEnvoyStats(k8sClient: K8sClient) {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return {}
    }
    const ingressEnvoyStats = {}
    for(const ingressPod of ingressPods) {
      ingressEnvoyStats[ingressPod.name] = await EnvoyFunctions.getEnvoyStats(k8sClient, "istio-system", ingressPod.name, "istio-proxy")
    }
    return ingressEnvoyStats
  }

  static async getIngressGatwayEnvoyServerInfo(k8sClient: K8sClient) {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return {}
    }
    const ingressEnvoyServerInfos = {}
    for(const ingressPod of ingressPods) {
      ingressEnvoyServerInfos[ingressPod.name] = await EnvoyFunctions.getEnvoyServerInfo(k8sClient, "istio-system", ingressPod.name, "istio-proxy")
    }
    return ingressEnvoyServerInfos
  }

  static async getIngressEnvoyConfigsForService(service: ServiceDetails, k8sClient: K8sClient) {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return []
    }
    return EnvoyFunctions.getEnvoyConfigsForService(service.name, service.namespace,
                            "istio-system", ingressPods[0].name, "istio-proxy", k8sClient)
  }

  static async getIngressEnvoyConfigsForFqdn(fqdn: string, k8sClient: K8sClient) {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return []
    }
    return EnvoyFunctions.getEnvoyConfigsForFqdn(fqdn, "istio-system", ingressPods[0].name, "istio-proxy", k8sClient)
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
