import jsonUtil from '../util/jsonUtil'
import {K8sClient} from './k8sClient'
import K8sFunctions from '../k8s/k8sFunctions';

export default class IstioFunctions {

  private static extractResource(result: any, ...specKeys) {
    const getResource = (obj) => {
      const resource = {
        ...K8sFunctions.extractMetadata(obj)
      }
      specKeys.forEach(key => obj.spec[key] && (resource[key] = obj.spec[key]))
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

  static listAllGateways = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.gateways.get(),
                              "selector", "servers") as any[]
  }

  static listAllIngressGateways = async (k8sClient: K8sClient) => {
    return (await IstioFunctions.listAllGateways(k8sClient) as any[])
            .filter(gateway => gateway.selector.istio === 'ingressgateway')
  }

  static listAllEgressGateways = async (k8sClient: K8sClient) => {
    return (await IstioFunctions.listAllGateways(k8sClient) as any[])
            .filter(gateway => gateway.selector.istio === 'egressgateway')
  }

  static getGatewaysForVirtualServices = async (virtualServices: any[], k8sClient: K8sClient) => {
    const allGateways = await IstioFunctions.listAllGateways(k8sClient)
    return allGateways.filter(g => 
      virtualServices.filter(vs => vs.gateways)
      .filter(vs => 
        vs.gateways.filter(vsg => vsg.includes(g.name)).length > 0
      ).length > 0
    )
  }

  static listAllVirtualServices = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.virtualservices.get(),
                            "gateways", "hosts", "http", "tls", "tcp") as any[]
  }

  static listAllIngressVirtualServices = async (k8sClient: K8sClient) => {
    const ingressGateways = (await IstioFunctions.listAllIngressGateways(k8sClient))
                            .map(g => g.name)
    return (await IstioFunctions.listAllVirtualServices(k8sClient))
            .filter(v => v.gateways && v.gateways.filter(g => 
              ingressGateways.filter(ig => g.includes(ig)).length > 0).length > 0)
  }

  static listAllEgressVirtualServices = async (k8sClient: K8sClient) => {
    const ingressGateways = (await IstioFunctions.listAllEgressGateways(k8sClient))
                            .map(g => g.name)
    return (await IstioFunctions.listAllVirtualServices(k8sClient))
            .filter(v => v.gateways && v.gateways.filter(g => ingressGateways.includes(g)).length > 0)
  }

  static filterVirtualServicesByRouteForService(virtualServices: any[], 
                      service: string, namespace: string, routeType: string) {
    const serviceHost = service + "." + namespace
    return virtualServices.filter(vs => vs[routeType] ?
      vs[routeType].filter(routeType => 
        routeType.route.filter(route => 
          route.destination.host.includes(vs.namespace === namespace ? service : serviceHost)).length > 0
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
    return IstioFunctions.extractResource(await k8sClient.istio.destinationrules.get(),
                                  "host", "trafficPolicy", "subsets") as any[]
  }

  static getServiceDestinationRules = async (service: string, namespace: string, k8sClient: K8sClient) => {
    const allDestinationRules = await IstioFunctions.listAllDestinationRules(k8sClient)
    let applicableDestinationRules: any[] = []
    applicableDestinationRules = applicableDestinationRules.concat(
          allDestinationRules.filter(r => r.host.includes(service)))
    applicableDestinationRules = applicableDestinationRules.concat(
      allDestinationRules.filter(r => 
        (r.host.includes("*") && r.host.includes(namespace)) || r.host.includes("*.local")))
    return applicableDestinationRules
  }

  static listAllServiceEntries = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.serviceentries.get(),
                      "hosts", "addresses", "ports", "location", "resolution", "endpoints") as any[]
  }

  static listAllEnvoyFilters = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.envoyfilters.get(),
                                "workloadLabels", "filters") as any[]
  }

  static listAllPolicies = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.policies.get(),
            "targets", "peers", "peerIsOptional", "origins", 
            "originIsOptional", "principalBinding") as any[]
  }

  static getServicePolicies = async (service: string, k8sClient: K8sClient) => {
    const allPolicies = await IstioFunctions.listAllPolicies(k8sClient)
    return allPolicies.filter(p => p.targets.filter(target => target.name.includes(service)).length > 0)
  }

  static listAllMeshPolicies = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.meshpolicies.get(),
            "targets", "peers", "peerIsOptional", "origins", 
            "originIsOptional", "principalBinding") as any[]
  }

  static listAllRules = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.rules.get(),
                                "match", "actions") as any[]
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
    namespaceDefaultPolicies.forEach(policy => namespacesWithDefaultMtls.push(policy.namespace))
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

  static getServiceMtlsStatuses = async (k8sClient: K8sClient) => {
    const policies = await IstioFunctions.listAllPolicies(k8sClient)
    const serviceMtlsPolicies = policies && policies.length ? 
                policies.filter(policy => /*policy.name !== 'default' && */
                      policy.peers && policy.peers.filter(peer => peer.mtls).length > 0
                      && policy.targets) : []
    const pilotPods = await K8sFunctions.getPodsByLabels("istio-system", "istio=pilot", k8sClient)
    let serviceMtlsStatuses: any = await K8sFunctions.podExec("istio-system", pilotPods[0].name, "discovery", k8sClient, 
                         ["/usr/local/bin/pilot-discovery", "request", "GET", "/debug/authenticationz"])
    serviceMtlsStatuses = serviceMtlsStatuses.slice(serviceMtlsStatuses.indexOf("["), serviceMtlsStatuses.indexOf("]")+1)
    if(serviceMtlsStatuses && serviceMtlsStatuses.length > 0) {
      try {
        serviceMtlsStatuses = JSON.parse(serviceMtlsStatuses)
        serviceMtlsStatuses = serviceMtlsStatuses
        .filter(status => status.host)
        .map(status => {
          const pieces = status.host.split(".")
          const serviceName = pieces.length > 0 ? pieces[0] : ""
          const namespace = pieces.length > 1 ? pieces[1] : ""
          let serviceMtlsMode = undefined
          const servicePolicies = serviceMtlsPolicies.filter(policy =>
              policy.targets.filter(target => target.name === serviceName
              && (!target.ports || target.ports.length === 0 
                  || target.ports.filter(port => port.number === status.port).length > 0)).length > 0)
          if(servicePolicies && servicePolicies.length > 0) {
            serviceMtlsMode = servicePolicies[0].peers.filter(peer => peer.mtls)[0].mtls.mode
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
      } 
      catch(err){
        console.log(err)
        serviceMtlsStatuses = []
      }
    } else {
      serviceMtlsStatuses = []
    }
    return serviceMtlsStatuses
  }

  static getServiceMtlsStatus = async (service: string, k8sClient: K8sClient) => {
    const serviceMtlsStatuses = await IstioFunctions.getServiceMtlsStatuses(k8sClient)
    const serviceMtlsStatus = serviceMtlsStatuses.filter(status => service.includes(status.serviceName))
    return serviceMtlsStatus.length > 0 ? serviceMtlsStatus[0] : {}
  }

}
