/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {K8sClient} from './k8sClient'
import K8sFunctions from './k8sFunctions'
import EnvoyFunctions from './envoyFunctions'
import { ServiceDetails, Cluster } from './k8sObjectTypes'
import {matchObjects, extractServiceFromFqdn, extractNamespaceFromFqdn, 
        getUniqueResources, FqdnMatcher, getUniqueResourcesByField} from '../util/matchUtil'
import KubectlClient from './kubectlClient'

export default class IstioFunctions {


  private static extractResource(result: any, ...specKeys) {
    const yaml = specKeys.includes("yaml")
    const getResource = (obj) => {
      const resource = {
        ...K8sFunctions.extractMetadata(obj)
      }
      specKeys.forEach(key => obj.spec[key] && (resource[key] = obj.spec[key]))
      if(yaml) {
        delete obj.metadata["generation"]
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
    if(k8sClient.istio) {
      const keys = ["selector", "servers"]
      yaml && keys.push("yaml")
      return IstioFunctions.extractResource(await k8sClient.istio.gateways.get(), ...keys) as any[]
    } else {
      return []
    }
  }

  static listAllIngressGateways = async (k8sClient: K8sClient, yaml: boolean = true) => {
    if(k8sClient.istio) {
      return (await IstioFunctions.listAllGateways(k8sClient, yaml) as any[])
            .filter(gateway => gateway.selector.istio === 'ingressgateway')
    } else {
      return []
    }
  }

  static listAllEgressGateways = async (k8sClient: K8sClient, yaml: boolean = true) => {
    if(k8sClient.istio) {
      return (await IstioFunctions.listAllGateways(k8sClient, yaml) as any[])
            .filter(gateway => gateway.selector.istio === 'egressgateway')
    } else {
      return []
    }
  }

  static matchGatewaysForVirtualService(virtualService: any, gateways: any[]) {
    return virtualService && gateways && virtualService.gateways ?
      gateways.filter(gateway =>
        virtualService.gateways.filter(vsg => 
          vsg === gateway.name && virtualService.namespace === gateway.namespace
          || vsg === gateway.name+"."+gateway.namespace
          || vsg.includes(gateway.name+"."+gateway.namespace+".") 
          || vsg === gateway.namespace+"/"+gateway.name
        ).length > 0) : []
  }

  static getIngressGatewaysForVirtualServices = async (virtualServices: any[], k8sClient: K8sClient, yaml: boolean = false) => {
    if(k8sClient.istio) {
      const allGateways = (await IstioFunctions.listAllGateways(k8sClient, yaml))
                        .filter(g => g.selector && g.selector.istio && g.selector.istio === 'ingressgateway')
      return virtualServices.map(vs => {
        return {
          virtualService: vs,
          gateways: IstioFunctions.matchGatewaysForVirtualService(vs, allGateways)
        }
      })
    } else {
      return []
    }
  }

  static getGatewaysForFqdn = async (fqdn: string, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      FqdnMatcher.init(fqdn)
      return (await IstioFunctions.listAllGateways(k8sClient, true))
            .filter(g => g.servers.filter(server => 
              server.hosts.filter(host => FqdnMatcher.matchDomain(host)).length > 0
            ).length > 0)
    } else {
      return []
    }
  }

  static getGatewaysForPorts = async (ports: number[], k8sClient: K8sClient) => {
    if(k8sClient.istio) {
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
    } else {
      return []
    }
  }

  static getNamespaceGateways = async (namespace: string, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      const allGateways = await IstioFunctions.listAllGateways(k8sClient, true)
      return allGateways.filter(g => g.namespace === namespace)
    } else {
      return []
    }
  }

  static listAllVirtualServices = async (k8sClient: K8sClient, yaml: boolean = true) => {
    if(k8sClient.istio) {
      const keys = ["gateways", "hosts", "http", "tls", "tcp"]
      yaml && keys.push("yaml")
      return IstioFunctions.extractResource(await k8sClient.istio.virtualservices.get(), ...keys) as any[]
    } else {
      return []
    }
  }

  static listAllIngressVirtualServices = async (k8sClient: K8sClient, yaml: boolean = true) => {
    if(k8sClient.istio) {
      const ingressGateways = await IstioFunctions.listAllIngressGateways(k8sClient)
      return (await IstioFunctions.listAllVirtualServices(k8sClient, yaml))
              .filter(vs => IstioFunctions.matchGatewaysForVirtualService(vs, ingressGateways).length > 0)
    } else {
      return []
    }
  }

  static listAllEgressVirtualServices = async (k8sClient: K8sClient, yaml: boolean = true) => {
    if(k8sClient.istio) {
      const egressGateways = (await IstioFunctions.listAllEgressGateways(k8sClient))
                            .map(g => g.name)
      return (await IstioFunctions.listAllVirtualServices(k8sClient, yaml))
              .filter(v => v.gateways && v.gateways.filter(g => egressGateways.includes(g)).length > 0)
    } else {
      return []
    }
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
    if(k8sClient.istio) {
      const allVirtualServices = await IstioFunctions.listAllVirtualServices(k8sClient)
      const httpVirtualServices = IstioFunctions.filterVirtualServicesByRouteForService(
                                  allVirtualServices, service, namespace, 'http')
      const tlsVirtualServices = IstioFunctions.filterVirtualServicesByRouteForService(
                                  allVirtualServices, service, namespace, 'tls')
      const tcpVirtualServices = IstioFunctions.filterVirtualServicesByRouteForService(
                                  allVirtualServices, service, namespace, 'tcp')
      return getUniqueResources(httpVirtualServices, tlsVirtualServices, tcpVirtualServices)
    } else {
      return []
    }
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
    if(k8sClient.istio) {
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
    } else {
      return []
    }
  }

  static getVirtualServicesForPorts = async (ports: number[], k8sClient: K8sClient) => {
    const portsOutput = {}
    if(k8sClient.istio) {
      const matchRoutePorts = (port, routeConfigs) => {
        portsOutput[port].matchPorts = portsOutput[port].matchPorts || []
        portsOutput[port].destinationPorts = portsOutput[port].destinationPorts || []
        routeConfigs.forEach(rc => {
          const rcMatchPorts = rc.match ? rc.match.filter(m => m.port).map(m => m.port) : []
          const rcDestPorts = (rc.route ? rc.route.map(r => r.destination && r.destination.port && r.destination.port.number) : []).filter(p => p)
          const matchesMatchPort = rcMatchPorts.includes(port)
          const matchesDestPort = rcDestPorts.includes(port)
          if(matchesDestPort) {
            portsOutput[port].matchPorts = _.uniqBy(portsOutput[port].matchPorts.concat(rcMatchPorts))
            if(!portsOutput[port].destinationPorts.includes(port)) {
              portsOutput[port].destinationPorts.push(port)
            }
          }
          if(matchesMatchPort) {
            portsOutput[port].destinationPorts = _.uniqBy(portsOutput[port].destinationPorts.concat(rcDestPorts))
            if(!portsOutput[port].matchPorts.includes(port)) {
              portsOutput[port].matchPorts.push(port)
            }
          }
        })
        return portsOutput[port].matchPorts.length > 0 || portsOutput[port].destinationPorts.length > 0
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
    }
    return portsOutput
  }

  static getNamespaceVirtualServices = async (namespace: string, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      const allVirtualServices = await IstioFunctions.listAllVirtualServices(k8sClient, true)
      return allVirtualServices.filter(vs => vs.namespace === namespace)
    } else {
      return []
    }
  }

  static listAllSidecarConfigs = async (k8sClient: K8sClient) => {
    if(k8sClient.istio && k8sClient.istio.sidecars) {
      return IstioFunctions.extractResource(await k8sClient.istio.sidecars.get(), 
                      "workloadSelector", "ingress", "egress", "yaml") as any[]
    } else {
      return []
    }
  }

  static getNamespaceSidecarConfigs = async (namespace: string, k8sClient: K8sClient) => {
    if(k8sClient.istio && k8sClient.istio.sidecars) {
      return (IstioFunctions.extractResource(await k8sClient.istio.sidecars.get(), 
                      "workloadSelector", "ingress", "egress", "yaml") as any[])
            .filter(sc => sc.namespace === namespace)
    } else {
      return []
    }
  }

  static getServiceEgressSidecarConfigs = async (service: ServiceDetails, k8sClient: K8sClient) => {
    return IstioFunctions.getPodEgressSidecarConfigs((service.selector||[]), service.namespace, k8sClient)
  }

  static getPodEgressSidecarConfigs = async (podLabels: string[], namespace: string, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      const allSidecarConfigs = await IstioFunctions.listAllSidecarConfigs(k8sClient)
      const nsSidecarConfigs = allSidecarConfigs.filter(sc => sc.namespace === namespace)
      const podSidecarConfigs = nsSidecarConfigs.filter(sc => 
        sc.workloadSelector && sc.workloadSelector.labels 
        && matchObjects(sc.workloadSelector.labels, podLabels))
      if(podSidecarConfigs.length > 0) {
        return podSidecarConfigs
      } else {
        return nsSidecarConfigs.filter(sc => !sc.workloadSelector)
      }
    } else {
      return []
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

  static getServiceIncomingSidecarConfigs = async (service: ServiceDetails, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      FqdnMatcher.initWithService(service.name, service.namespace)
      const allSidecarConfigs = await IstioFunctions.listAllSidecarConfigs(k8sClient)
      return allSidecarConfigs.filter(sc => IstioFunctions.matchSidecarEgressHost(sc, true))
    } else {
      return []
    }
  }

  static getSidecarConfigsForFqdn = async (fqdn: string, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      FqdnMatcher.init(fqdn)
      const allSidecarConfigs = await IstioFunctions.listAllSidecarConfigs(k8sClient)
      return allSidecarConfigs.filter(sc => 
        FqdnMatcher.matchNamespace(sc.namespace) || IstioFunctions.matchSidecarEgressHost(sc, false)
      )
    } else {
      return []
    }
  }

  static listAllDestinationRules = async (k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      return IstioFunctions.extractResource(await k8sClient.istio.destinationrules.get(), "yaml") as any[]
    } else {
      return []
    }
  }

  static extractDestinationRules(result) {
    return IstioFunctions.extractResource(result, "host", "trafficPolicy", "subsets", "exportTo") as any[]
  }

  static getServiceDestinationRules = async (service: ServiceDetails, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      FqdnMatcher.initWithService(service.name, service.namespace)
      const allDestinationRules = IstioFunctions.extractDestinationRules(await k8sClient.istio.destinationrules.get())
      const applicableDestinationRules = allDestinationRules.filter(r => FqdnMatcher.matchHost(r.host))
      return applicableDestinationRules
    } else {
      return []
    }
  }

  static getClientNamespaceDestinationRules = async (namespace: string, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      return (IstioFunctions.extractDestinationRules(await k8sClient.istio.destinationrules.get()))
            .filter(dr => dr.namespace === namespace)
    } else {
      return []
    }
  }

  static getNamespaceDestinationRules = async (namespace: string, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      return (await IstioFunctions.listAllDestinationRules(k8sClient))
            .filter(dr => dr.namespace === namespace)
    } else {
      return []
    }
  }

  static getDestinationRulesForFqdn = async (fqdn: string, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      FqdnMatcher.init(fqdn)
      return (await IstioFunctions.listAllDestinationRules(k8sClient))
              .filter(dr => FqdnMatcher.matchDomain(dr.yaml.spec.host))
    } else {
      return []
    }
  }

  static listAllServiceEntries = async (k8sClient: K8sClient, yaml: boolean = true) => {
    if(k8sClient.istio) {
      const fields = ["hosts", "addresses", "ports", "location", "resolution", "endpoints"]
      yaml && fields.push("yaml")
      return IstioFunctions.extractResource(await k8sClient.istio.serviceentries.get(), ...fields) as any[]
    } else {
      return []
    }
  }

  static getNamespaceServiceEntries = async (namespace: string, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      return (await IstioFunctions.listAllServiceEntries(k8sClient))
            .filter(se => se.namespace === namespace)
    } else {
      return []
    }
  }

  static getServiceServiceEntries = async (service: ServiceDetails, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      FqdnMatcher.initWithService(service.name, service.namespace)
      const allServiceEntries = await IstioFunctions.listAllServiceEntries(k8sClient, false)
      return allServiceEntries.filter(se => 
        se.hosts && se.hosts.filter(host => FqdnMatcher.matchHost(host)).length > 0
        || se.endpoints && se.endpoints.filter(e => FqdnMatcher.matchHost(e.address)).length > 0
      )
    } else {
      return []
    }
  }

  static getServiceEntriesForFqdn = async (fqdn: string, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      FqdnMatcher.init(fqdn)
      return (await IstioFunctions.listAllServiceEntries(k8sClient, true))
        .filter(se =>
          se.hosts && se.hosts.filter(host => FqdnMatcher.matchDomain(host)).length > 0
          || se.endpoints && se.endpoints.filter(e => FqdnMatcher.matchDomain(e.address)).length > 0)
    } else {
      return []
    }
  }

  static listAllEnvoyFilters = async (k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      return IstioFunctions.extractResource(await k8sClient.istio.envoyfilters.get(),
                                "workloadLabels", "filters", "yaml") as any[]
    } else {
      return []
    }
  }

  static listAllPolicies = async (k8sClient: K8sClient, yaml: boolean = true) => {
    if(k8sClient.istio) {
      const fields = ["targets", "peers", "peerIsOptional", "origins", 
                    "originIsOptional", "principalBinding"]
      yaml && fields.push("yaml")
      return IstioFunctions.extractResource(await k8sClient.istio.policies.get(), ...fields) as any[]
    } else {
      return []
    }
  }

  static getServicePolicies = async (service: ServiceDetails, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      const allPolicies = await IstioFunctions.listAllPolicies(k8sClient, false)
      return allPolicies.filter(p => 
        (p.name === "default" && p.namespace === service.namespace && !p.targets)
        || 
        (p.targets && p.targets.filter(target => 
            target.name === service.name || target.name.includes(service+".")).length > 0)
      )
    } else {
      return []
    }
  }

  static getNamespacePolicies = async (namespace: string, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      return (await IstioFunctions.listAllPolicies(k8sClient, true))
            .filter(p => p.namespace === namespace)
    } else {
      return []
    }
  }

  static getPoliciesForFqdn = async (fqdn: string, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      FqdnMatcher.init(fqdn)
      return (await IstioFunctions.listAllPolicies(k8sClient, true))
              .filter(p => FqdnMatcher.matchNamespace(p.namespace) &&
                (!p.targets || p.targets.filter(t => FqdnMatcher.matchService(t.name)).length > 0))
    } else {
      return []
    }
  }

  static listAllMeshPolicies = async (k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      return IstioFunctions.extractResource(await k8sClient.istio.meshpolicies.get(),
            "targets", "peers", "peerIsOptional", "origins", 
            "originIsOptional", "principalBinding", "yaml") as any[]
    } else {
      return []
    }
  }

  static listAllRules = async (k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      return IstioFunctions.extractResource(await k8sClient.istio.rules.get(),
                                "match", "actions", "yaml") as any[]
    } else {
      return []
    }
  }

  static getNamespaceRules = async (namespace: string, k8sClient: K8sClient) => {
    if(k8sClient.istio) {
      const allRules = await IstioFunctions.listAllRules(k8sClient)
      return allRules.filter(r => r.namespace === namespace)
    } else {
      return []
    }
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

  static async getIstioServicePodsList(labels: string, k8sClient: K8sClient) {
    return K8sFunctions.getPodsListByLabels("istio-system", labels, k8sClient)
  }

  static async getIstioServicePods(labels: string, k8sClient: K8sClient, loadDetails: boolean = false) {
    const ingressPods = await K8sFunctions.getPodsByLabels("istio-system", labels, k8sClient)
    return ingressPods.map(pod => {
      return {
        name: pod.name,
        namespace: pod.namespace,
        podIP: pod.podIP,
        hostIP: pod.hostIP,
        startTime: pod.startTime,
        conditions: pod.conditions,
        podDetails: loadDetails ? pod : undefined
      }
    })
  }

  static async getAnyIngressGatewayPod(k8sClient: K8sClient) {
    return (await IstioFunctions.getIstioServicePods("istio=ingressgateway", k8sClient, true))[0].podDetails
  }

  static async getIngressGatewayPods(k8sClient: K8sClient, loadDetails: boolean = false) {
    return IstioFunctions.getIstioServicePods("istio=ingressgateway", k8sClient, loadDetails)
  }

  static async getIngressGatewayPodsList(k8sClient: K8sClient) {
    return IstioFunctions.getIstioServicePodsList("istio=ingressgateway", k8sClient)
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

  static async resolveIngressPodName(k8sClient: K8sClient, podName?: string) {
    if(!podName) {
      const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
      if(!ingressPods || ingressPods.length === 0) {
        console.log("IngressGateway not found")
      } else {
        podName = ingressPods[0].name
      }
    }
    return podName
  }

  static async getIngressGatewayEnvoyBootstrapConfig(k8sClient: K8sClient, podName?: string) {
    podName = await IstioFunctions.resolveIngressPodName(k8sClient, podName)
    return podName ? EnvoyFunctions.getEnvoyBootstrapConfig(k8sClient, "istio-system", podName, "istio-proxy") : []
  }
  
  static async getIngressGatewayEnvoyConfigs(configType: string, k8sClient: K8sClient, podName?: string) {
    podName = await IstioFunctions.resolveIngressPodName(k8sClient, podName)
    if(podName) {
      if(configType.includes("Cluster")) {
        return EnvoyFunctions.getEnvoyClusters(k8sClient, "istio-system", podName, "istio-proxy")
      }
      if(configType.includes("Listener")) {
        return EnvoyFunctions.getEnvoyListeners(k8sClient, "istio-system", podName, "istio-proxy")
      }
      if(configType.includes("Route")) {
        return EnvoyFunctions.getEnvoyRoutes(k8sClient, "istio-system", podName, "istio-proxy")
      }
    }
    return []
  }
  
  static async getIngressGatewayEnvoyClusters(k8sClient: K8sClient, podName?: string) {
    return IstioFunctions.getIngressGatewayEnvoyConfigs("Clusters", k8sClient, podName)
  }
  
  static async getIngressGatewayEnvoyListeners(k8sClient: K8sClient, podName?: string) {
    return IstioFunctions.getIngressGatewayEnvoyConfigs("Listeners", k8sClient, podName)
  }
  
  static async getIngressGatewayEnvoyRoutes(k8sClient: K8sClient, podName?: string) {
    return IstioFunctions.getIngressGatewayEnvoyConfigs("Routes", k8sClient, podName)
  }
  
  static async getAllIngressGatewayEnvoyConfigs(k8sClient: K8sClient, podName?: string) {
    podName = await IstioFunctions.resolveIngressPodName(k8sClient, podName)
    return podName ? EnvoyFunctions.getAllEnvoyConfigs(k8sClient, "istio-system", podName, "istio-proxy") : {}
  }

  static async getIngressGatwayEnvoyStats(pod: string, k8sClient: K8sClient) {
    return await EnvoyFunctions.getEnvoyStats(k8sClient, "istio-system", pod, "istio-proxy")
  }

  static async getIngressGatwayEnvoyServerInfo(pod: string, k8sClient: K8sClient) {
    return await EnvoyFunctions.getEnvoyServerInfo(k8sClient, "istio-system", pod, "istio-proxy")
  }

  static async getIngressPodEnvoyConfigsForService(ingressPod: string, service: ServiceDetails, k8sClient: K8sClient) {
    return EnvoyFunctions.getEnvoyConfigsForService(service.name, service.namespace,
                            "istio-system", ingressPod, "istio-proxy", k8sClient)
  }

  static async getIngressEnvoyConfigsForService(service: ServiceDetails, k8sClient: K8sClient) {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return []
    }
    return IstioFunctions.getIngressPodEnvoyConfigsForService(ingressPods[0].name, service, k8sClient)
  }

  static async getIngressPodEnvoyConfigsForFqdn(ingressPod: string, fqdn: string, k8sClient: K8sClient) {
    return await EnvoyFunctions.getEnvoyConfigsForFqdn(fqdn, "istio-system", ingressPod, "istio-proxy", k8sClient)
  }

  static async getIngressEnvoyConfigsForFqdn(fqdn: string, k8sClient: K8sClient) {
    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      console.log("IngressGateway not found")
      return []
    }
    const results: any[] = []
    for(const pod of ingressPods) {
      const configs = await IstioFunctions.getIngressPodEnvoyConfigsForFqdn(pod.name, fqdn, k8sClient)
      results.push({pod: pod.name, configs})
    }
    return results
  }

  static async executeOnPilotPod(k8sClient: K8sClient, pilotPod: string, command: string[]) {
    if(k8sClient.canPodExec) {
      return K8sFunctions.podExec("istio-system", pilotPod, "discovery", k8sClient, command)
    } else {
      return ""
    }
  }

  static async executeOnAnyPilotPod(k8sClient: K8sClient, command: string[]) {
    if(k8sClient.canPodExec) {
      const pilotPods = await IstioFunctions.getPilotPods(k8sClient)
      return K8sFunctions.podExec("istio-system", pilotPods[0].name, "discovery", k8sClient, command)
    } else {
      return ""
    }
  }

  static async executeOnAllPilotPods(k8sClient: K8sClient, command: string[]) {
    const results: any[] = []
    if(k8sClient.canPodExec) {
      const pilotPods = await IstioFunctions.getPilotPods(k8sClient)
      for(const pod of pilotPods) {
        const result = await K8sFunctions.podExec("istio-system", pod.name, "discovery", k8sClient, command)
        results.push({pod,result})
      }
    }
    return results
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
        const text = service + "." + namespace + ".svc.cluster.local"
        pilotEndpoints = pilotEndpoints.filter(e => e.clusterName.includes(text))
      }
      return pilotEndpoints
    }
    return []
  }

  static async getPilotMetrics(k8sClient: K8sClient, pilotPod: string) {
    if(!k8sClient.istio) {
      return 
    }
    return IstioFunctions.executeOnPilotPod(k8sClient, pilotPod,
                                  ["curl", "-s", "localhost:8080/metrics"])
  }

  static async getPilotSidecarSyncStatus(k8sClient: K8sClient, pilotPod: string) {
    if(!k8sClient.istio) {
      return []
    }
    const result = await IstioFunctions.executeOnPilotPod(k8sClient, pilotPod,
                                  ["curl", "-s", "localhost:8080/debug/syncz"])
    return result ? JSON.parse(result) as any[] : []
  }

  static async getPilotConfigDump(k8sClient: K8sClient, pilotPod: string, proxyID: string, configType?: string) {
    try {

      const result = JSON.parse(await IstioFunctions.executeOnPilotPod(k8sClient, pilotPod,
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

  static async getPilotRegistryConfig(k8sClient: K8sClient, fqdn?: string) {
    if(!k8sClient.istio) {
      return 
    }
    const result = await IstioFunctions.executeOnAnyPilotPod(k8sClient,
                                  ["curl", "-s", "localhost:8080/debug/registryz"])
    if(result) {
      let items = (JSON.parse(result) as any[]).map(item => {
        return {
          id: item.Attributes.UID,
          hostname: item.hostname,
          name: item.Attributes.Name,
          namespace: item.Attributes.Namespace,
          address: item.address,
          ports: item.ports,
          meshExternal: item.MeshExternal,
          creationTime: item.creationTime,
          exportTo: item.Attributes.ExportTo,
        }
      })
      if(fqdn) {
        FqdnMatcher.init(fqdn)
        items = items.filter(item => FqdnMatcher.matchDomain(item.hostname))

      }
      return items
    }
    return []
  }

  static async getConfigResourcesFromPilot(k8sClient: K8sClient, resourceType: string) {
    if(!k8sClient.istio) {
      return
    }
    const result = await IstioFunctions.executeOnAnyPilotPod(k8sClient,
                                  ["curl", "-s", "localhost:8080/debug/configz"])
    if(result) {
      return (JSON.parse(result) as any[]).filter(i => i.type === resourceType)
        .map(i => {
          return {
            name: i.name,
            namespace: i.namespace,
            domain: i.domain,
            resourceVersion: i.resourceVersion,
            creationTimestamp: i.creationTimestamp,
            spec: i.Spec
          }
        })
    }
    return []
  }

  static async getVirtualServicesFromPilot(k8sClient: K8sClient) {
    return IstioFunctions.getConfigResourcesFromPilot(k8sClient, "virtual-service")
  }

  static async getGatewaysFromPilot(k8sClient: K8sClient) {
    return IstioFunctions.getConfigResourcesFromPilot(k8sClient, "gateway")
  }

  static async getDestinationRulesFromPilot(k8sClient: K8sClient) {
    return IstioFunctions.getConfigResourcesFromPilot(k8sClient, "destination-rule")
  }

  static extractEnvoyProxies(data: any[], pilotPod: string) {
    const proxies: any[] = []
    data.filter(cds => cds.node.startsWith("sidecar~") || cds.node.startsWith("router~"))
        .map(cds => cds.node.split("~"))
        .forEach(pieces => {
          const podAndNamespace = pieces[2].split(".")
          proxies.push({
            ip: pieces[1],
            pod: podAndNamespace[0],
            namespace: podAndNamespace[1],
            pilotPod: pilotPod,
            title: podAndNamespace[0]+"."+podAndNamespace[1]
          })
        })
    return proxies
  }

  static getAllEnvoyProxiesViaAPI = async (k8sClient: K8sClient) => {
    const proxies: any[] = []
    if(!k8sClient.istio || !k8sClient.canPodExec) {
      return proxies
    }
    const results = await IstioFunctions.executeOnAllPilotPods(k8sClient,
                                  ["curl", "-s", "localhost:8080/debug/adsz"])
    results.forEach(({pod,result}) => {
      if(result) {
        const pilotCDSData = JSON.parse(result) as any[]
        proxies.push(...IstioFunctions.extractEnvoyProxies(pilotCDSData, pod.name))
      }
    })
    return proxies
  }

  static async getAllEnvoyProxies(k8sClient: K8sClient) {
    const proxies: any[] = []
    if(!k8sClient.istio) {
      return proxies
    }
    const cluster = k8sClient.cluster
    if(cluster.hasKubectl) {
      const pilotPods = await KubectlClient.getPods(cluster, "istio-system", "pilot")
      for(const pilotPod of pilotPods) {
        let result: any = await KubectlClient.executeCommand(
          "kubectl exec --context " + cluster.context + " -n istio-system " + pilotPod.name 
            + " -c discovery -- curl -s localhost:8080/debug/adsz")
        if(result) {
          const pilotCDSData = JSON.parse(result) as any[]
          proxies.push(...IstioFunctions.extractEnvoyProxies(pilotCDSData, pilotPod.name))
        }
      }
    } else {
      return this.getAllEnvoyProxiesViaAPI(k8sClient)
    }
    return proxies
  }


  static getNamespaceEnvoyProxies = async (namespace: string, k8sClient: K8sClient) => {
    const proxies = await IstioFunctions.getAllEnvoyProxies(k8sClient)
    return proxies.filter(s => s.namespace === namespace)
  }

  static async getSidecarInjectorWebhook(k8sClient: K8sClient) {
    const result = await k8sClient.admissionregistration.mutatingwebhookconfigurations.get()
    if(result && result.body) {
      const injector = (result.body.items as any[]).filter(i => i.metadata.name === "istio-sidecar-injector")[0]
      if(injector) {
        return injector.webhooks[0]
      }
    }
  }
}
