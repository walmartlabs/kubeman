/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {K8sClient} from './k8sClient'
import K8sFunctions from '../k8s/k8sFunctions'
import {getUniqueResourcesByField, FqdnMatcher, getFqdnFromCluster} from '../util/matchUtil'

export enum EnvoyConfigType {
  Bootstrap = "BootstrapConfig",
  Clusters = "ClustersConfig",
  Listeners = "ListenersConfig",
  Routes = "RoutesConfig"
}

export default class EnvoyFunctions {

  static getKeysForType(type: string) {
    switch(type) {
      case EnvoyConfigType.Bootstrap:
        return ["bootstrap"]
      case EnvoyConfigType.Clusters:
        return ["static_clusters", "dynamic_active_clusters", "dynamic_warming_clusters", "dynamicActiveClusters"]
      case EnvoyConfigType.Listeners:
        return ["static_listeners", "dynamic_active_listeners", "dynamic_warming_listeners", "dynamic_draining_listeners", "dynamicActiveListeners"]
      case EnvoyConfigType.Routes:
        return ["static_route_configs", "dynamic_route_configs", "dynamicRouteConfigs"]
      default:
        return []
    }
  }

  static async getEnvoyConfigDump(k8sClient: K8sClient, namespace: string, pod: string, container: string) : Promise<any[]> {
    if(k8sClient.canPodExec) {
      try {
        const result = JSON.parse(await K8sFunctions.podExec(namespace, pod, container, k8sClient, 
                                    ["curl", "-s", "http://127.0.0.1:15000/config_dump"]))
        if(result.configs.clusters) {
          result.configs = Object.values(result.configs)
        }
        return result.configs
      } catch(error) {
        console.log(error)
      }
    }
    return []
  }


  static extractEnvoyConfigForType(configs: any[], configType: EnvoyConfigType) {
    const keys = EnvoyFunctions.getKeysForType(configType)
    configs = configs.filter(c => c["@type"].includes(configType))[0]
    const configItems = {}
    keys.forEach(key => {
      if(configs[key]) {
        configItems[key] = configs[key]
      }
    })
    return configItems
  }

  static async getEnvoyConfigForType(k8sClient: K8sClient, namespace: string, pod: string, container: string, 
                                      configType: EnvoyConfigType) {
    if(k8sClient.canPodExec) {
      try {
        let configs = await EnvoyFunctions.getEnvoyConfigDump(k8sClient, namespace, pod, container)
        return EnvoyFunctions.extractEnvoyConfigForType(configs, configType)
      } catch(error) {
        console.log(error)
      }
    }
    return []
  }

  static prepareEnvoyBootstrapConfig(configs: any) {
    const preparedBootstrapConfigs: any[] = []
    Object.keys(configs).forEach(key => {
      configs[key].title = configs[key].node.id + " ("+key+")"
      preparedBootstrapConfigs.push(configs[key])
    })
    return preparedBootstrapConfigs
  }

  static async prepareEnvoyClustersConfig(clusterConfigs: any, loadStatus: boolean = false, 
                            namespace: string = '', pod: string = '', container: string = '', k8sClient?: K8sClient) {
    const clusterStatusMap = {}
    if(loadStatus && k8sClient && k8sClient.canPodExec) {
      const result = JSON.parse(await K8sFunctions.podExec(namespace, pod, container, k8sClient,
        ["curl", "-s", "http://127.0.0.1:15000/clusters?format=json"]))
      result.cluster_statuses && result.cluster_statuses.forEach &&
        result.cluster_statuses.forEach(cs => clusterStatusMap[cs.name] = cs)
    }
    const preparedClusterConfigs: any[] = []
    Object.keys(clusterConfigs).forEach(key => {
      clusterConfigs[key].forEach(config => {
        config.name = config.cluster.name
        config.title = config.name + " ("+key+")"
        if(loadStatus) {
          const clusterStatus = clusterStatusMap[config.name]
          if(clusterStatus) {
            delete clusterStatus.name
            config.status = clusterStatus
          }
        }
        preparedClusterConfigs.push(config)
      })
    })
    return preparedClusterConfigs
  }

  static prepareEnvoyListenersConfig(listenersConfigs: any) {
    const preparedListenerConfigs: any[] = []
    Object.keys(listenersConfigs).forEach(key => {
      listenersConfigs[key].forEach(config => {
        const socketAddress = config.listener.address.socket_address || config.listener.address.socketAddress
        config.name = socketAddress.address+":"+(socketAddress.port_value||socketAddress.portValue)
        config.title = config.name + " ("+key+")"
        preparedListenerConfigs.push(config)
      })
    })
    return preparedListenerConfigs
  }

  static prepareEnvoyRoutesConfig(routesConfigs: any) {
    const preparedRouteConfigs: any[] = []
    Object.keys(routesConfigs).forEach(key => {
      routesConfigs[key].forEach(r => {
        const routeConfig = r.route_config || r.routeConfig
        const virtualHosts = routeConfig.virtual_hosts || routeConfig.virtualHosts
        virtualHosts && virtualHosts.map(vh => {
          if(routeConfig.name) {
            vh.title = routeConfig.name + " > " + vh.name
          } else {
            vh.title = vh.name
          }
          vh.title += " ("+key+")"
          vh.last_updated = r.last_updated || r.lastUpdated
          preparedRouteConfigs.push(vh)
        })
      })
    })
    return preparedRouteConfigs
  }

  static async getEnvoyBootstrapConfig(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    return EnvoyFunctions.prepareEnvoyBootstrapConfig(
          await EnvoyFunctions.getEnvoyConfigForType(k8sClient, namespace, pod, container, EnvoyConfigType.Bootstrap))
  }

  static async getEnvoyClusters(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    return EnvoyFunctions.prepareEnvoyClustersConfig(
        await EnvoyFunctions.getEnvoyConfigForType(k8sClient, namespace, pod, container, EnvoyConfigType.Clusters),
                                                      true, namespace, pod, container, k8sClient)
  }

  static async getEnvoyListeners(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    return EnvoyFunctions.prepareEnvoyListenersConfig(
            await EnvoyFunctions.getEnvoyConfigForType(k8sClient, namespace, pod, container, EnvoyConfigType.Listeners))
  }

  static async getEnvoyRoutes(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    return EnvoyFunctions.prepareEnvoyRoutesConfig(
            await EnvoyFunctions.getEnvoyConfigForType(k8sClient, namespace, pod, container, EnvoyConfigType.Routes))
  }

  static async getAllEnvoyConfigs(k8sClient: K8sClient, namespace: string, pod: string, container: string) : Promise<Object> {
    if(k8sClient.canPodExec) {
      try {
        let configs = await EnvoyFunctions.getEnvoyConfigDump(k8sClient, namespace, pod, container)
        const configsByType = {}
        configsByType[EnvoyConfigType.Clusters] = await EnvoyFunctions.prepareEnvoyClustersConfig(
                        EnvoyFunctions.extractEnvoyConfigForType(configs, EnvoyConfigType.Clusters), true,
                        namespace, pod, container, k8sClient)
        configsByType[EnvoyConfigType.Listeners] = EnvoyFunctions.prepareEnvoyListenersConfig(
                        EnvoyFunctions.extractEnvoyConfigForType(configs, EnvoyConfigType.Listeners))
        configsByType[EnvoyConfigType.Routes] = EnvoyFunctions.prepareEnvoyRoutesConfig(
                        EnvoyFunctions.extractEnvoyConfigForType(configs, EnvoyConfigType.Routes))
        return configsByType
      } catch(error) {
        console.log(error)
      }
    }
    return {}
  }

  static async getEnvoyStats(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    if(k8sClient.canPodExec) {
      return K8sFunctions.podExec(namespace, pod, container, k8sClient, 
                                  ["curl", "-s", "http://127.0.0.1:15000/stats"])
    } else {
      return ""
    }
  }

  static async getEnvoyServerInfo(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    if(k8sClient.canPodExec) {
      return JSON.parse(await K8sFunctions.podExec(namespace, pod, container, k8sClient, 
                                ["curl", "-s", "http://127.0.0.1:15000/server_info"]))
    } else {
      return {}
    }
  }

  static async listEnvoyListeners(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    if(k8sClient.canPodExec) {
      return JSON.parse(await K8sFunctions.podExec(namespace, pod, container, k8sClient, 
                                ["curl", "-s", "http://127.0.0.1:15000/listeners"]))
    } else {
      return []
    }
  }

  static async getEnvoyListenerPorts(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    return (await EnvoyFunctions.listEnvoyListeners(k8sClient, namespace, pod, container))
            .map(l => l.split(":")[1]).filter(p => p).map(p => parseInt(p))
  }

  static async getEnvoyLoadedCerts(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    if(k8sClient.canPodExec) {
      let commandOutput: any = (await K8sFunctions.podExec(namespace, pod, container, k8sClient, 
                                ["curl", "-s", "http://127.0.0.1:15000/certs"])).trim()
      try {
        commandOutput = JSON.parse(commandOutput)
      } catch(error) {
        commandOutput = commandOutput.replace(/}/g, "},")
        commandOutput = commandOutput.slice(0, commandOutput.lastIndexOf(","))
        commandOutput = "[" + commandOutput + "]"
        commandOutput = JSON.parse(commandOutput)
      }
      if(commandOutput.map) {
        return commandOutput
      } else if(commandOutput.certificates) {
        return commandOutput.certificates
      }
    }
    return []
  }

  static async getEnvoyConfigsForService(service: string, serviceNamespace: string, envoyNamespace: string, 
                                          envoyPod: string, envoyContainer: string, k8sClient: K8sClient) {
    return EnvoyFunctions.getEnvoyConfigsForFqdn(service+"."+serviceNamespace, envoyNamespace, envoyPod, envoyContainer, k8sClient)
  }

  static async getEnvoyConfigsForFqdn(fqdn: string, envoyNamespace: string, envoyPod: string, 
                                      envoyContainer: string, k8sClient: K8sClient) {
    const configsByType = await EnvoyFunctions.getAllEnvoyConfigs(k8sClient, envoyNamespace, envoyPod, envoyContainer)
    return EnvoyFunctions.extractEnvoyConfigsForFqdn(configsByType, fqdn)
  }

  private static extractEnvoyConfigsForFqdn(configsByType: any, fqdn: string) {
    FqdnMatcher.init(fqdn)
    const clusters = configsByType[EnvoyConfigType.Clusters]
    const listeners = configsByType[EnvoyConfigType.Listeners]
    const routes = configsByType[EnvoyConfigType.Routes]

    const domainMatcheRoutes = EnvoyFunctions.filterRoutesByDomainMatch(routes)
    const clusterMatcheRoutes = EnvoyFunctions.filterRoutesByClusterMatch(routes)
    const fqdnRoutes = domainMatcheRoutes.concat(clusterMatcheRoutes)

    const domainMatchListeners = EnvoyFunctions.filterListenersByDomainMatch(listeners)
    const clusterMatchListeners = EnvoyFunctions.filterListenersByClusterMatch(listeners)
    const fqdnListeners = domainMatchListeners.concat(clusterMatchListeners)
    const routeListeners = EnvoyFunctions.filterListenersForRoutes(listeners, fqdnRoutes)

    const fqdnClusters = EnvoyFunctions.filterClustersForFqdn(clusters)
    const listenerClusters = EnvoyFunctions.filterClustersForListeners(clusters, domainMatchListeners)
    const routeClusters = EnvoyFunctions.filterClustersForRoutes(clusters, domainMatcheRoutes)
    
    const listenerRoutes = EnvoyFunctions.filterRoutesForListeners(routes, listeners)

    configsByType[EnvoyConfigType.Clusters] = getUniqueResourcesByField("title", fqdnClusters, routeClusters, listenerClusters)
    configsByType[EnvoyConfigType.Listeners] = getUniqueResourcesByField("title", fqdnListeners, routeListeners)
    configsByType[EnvoyConfigType.Routes] = getUniqueResourcesByField("title", fqdnRoutes, listenerRoutes)

    configsByType[EnvoyConfigType.Listeners] = configsByType[EnvoyConfigType.Listeners].map(l => {
      if(l.matchingFilterChains && l.matchingFilterChains.length > 0) {
        l.listener['filter_chains(applicable)'] = _.uniqBy(l.matchingFilterChains, fc => fc.filter_chain_match)
        delete l.listener.filter_chains
        delete l.matchingFilterChains
      }
      return l
    })
    return configsByType
  }

  private static filterClustersForFqdn(clusters: any[]) {
    if(clusters) {
      const nameMatches = clusters.filter(c => FqdnMatcher.matchDomain(getFqdnFromCluster(c.cluster.name)))
      const hostMatches = clusters
        .filter(c => c.cluster.hosts && 
          c.cluster.hosts.filter(h => FqdnMatcher.matchDomain(h.socket_address.address)).length > 0)

      const lbEndpointMatches = clusters
        .filter(c => c.cluster.load_assignment)
        .filter(c => {
          const endpoints = c.cluster.load_assignment.endpoints && 
                            _.flatten(c.cluster.load_assignment.endpoints
                                        .filter(e => e.lb_endpoints).map(e => e.lb_endpoints))
                            .map(e => e.endpoint.address.socket_address.address)
          return endpoints && endpoints.filter(e => FqdnMatcher.matchDomain(e)).length > 0
        })
      return getUniqueResourcesByField("title", nameMatches, hostMatches, lbEndpointMatches)
    } else {
      return []
    }
  }

  private static filterListenersByDomainMatch(listeners: any[]) {
    return listeners ? listeners.filter(l => {
      const matchingFilterChains = l.listener.filter_chains.filter(fc => {
        const serverNames = fc.filter_chain_match && fc.filter_chain_match.server_names ? fc.filter_chain_match.server_names : []
        return serverNames.filter(n => FqdnMatcher.matchDomain(n)).length > 0
        || fc.filters && fc.filters.filter(f => 
              f.config.route_config && f.config.route_config.virtual_hosts
                  && f.config.route_config.virtual_hosts.filter(vh => 
                        vh.domains && vh.domains.filter(domain => FqdnMatcher.matchDomain(domain)).length > 0).length > 0
            ).length > 0
      })
      matchingFilterChains.length > 0 && 
        (l.matchingFilterChains = (l.matchingFilterChains||[]).concat(matchingFilterChains))
      return matchingFilterChains.length > 0
    }) : []
  }

  private static filterListenersByClusterMatch(listeners: any[]) {
    return listeners ? listeners.filter(l => {
      const matchingFilterChains = l.listener.filter_chains.filter(fc =>
        fc.filters && fc.filters.filter(f => f.config.cluster && 
          FqdnMatcher.matchDomain(getFqdnFromCluster(f.config.cluster))).length > 0)
      matchingFilterChains.length > 0 && 
        (l.matchingFilterChains = (l.matchingFilterChains||[]).concat(matchingFilterChains))
      return matchingFilterChains.length > 0
    }) : []
  }

  private static filterRoutesByDomainMatch(routes: any[]) {
    return routes ? routes.filter(r => {
      return r.domains && r.domains.filter(domain => FqdnMatcher.matchDomain(domain)).length > 0
    }) : []
  }

  private static filterRoutesByClusterMatch(routes: any[]) {
    return routes ? routes.filter(r => {
      return r.routes && r.routes.filter(rt => rt.route && rt.route.cluster)
        .filter(rt => FqdnMatcher.matchDomain(getFqdnFromCluster(rt.route.cluster))).length > 0
    }) : []
  }

  private static filterClustersForListeners(clusters: any[], listeners: any[]) {
    return clusters ? clusters.filter(c =>
        _.flatten(_.flatten(listeners.filter(l => l.matchingFilterChains && l.matchingFilterChains.length > 0)
                    .map(l => l.matchingFilterChains))
                .map(fc => fc.filters || []))
        .map(f => f.config.cluster)
        .filter(c => c)
        .filter(lc => c.title === lc)
        .length > 0
    ) : []
  }

  private static filterClustersForRoutes(clusters: any[], routes: any[]) {
    return clusters ? clusters.filter(c =>
        _.flatten(routes.map(r => r.routes))
        .map(r => r.route && r.route.cluster)
        .filter(c => c)
        .filter(lc => c.title === lc)
        .length > 0
    ) : []
  }

  private static filterListenersForClusters(listeners: any[], clusters: any[]) {
    return listeners ? listeners.filter(l => {
      const matchingFilterChains = l.listener.filter_chains.filter(fc =>
        fc.filters && fc.filters.filter(f => 
          f.config.cluster && clusters.filter(c => c.title === f.config.cluster).length > 0
          ||
          f.config.route_config && f.config.route_config.virtual_hosts && 
            f.config.route_config.virtual_hosts.filter(vh => 
              vh.routes && vh.routes.filter(vhr => vhr.route.cluster &&
                clusters.filter(c => c.title === vhr.route.cluster).length > 0).length > 0).length > 0
        ).length > 0
      )
      matchingFilterChains.length > 0 && 
        (l.matchingFilterChains = (l.matchingFilterChains||[]).concat(matchingFilterChains))
      return matchingFilterChains.length > 0
    }) : []
  }

  private static filterListenersForRoutes(listeners: any[], routes: any[]) {
    return listeners ? listeners.filter(l => {
      const matchingFilterChains = l.listener.filter_chains.filter(fc =>
        fc.filters && fc.filters.filter(f => f.config.rds && 
            routes.filter(r => r.title.includes(f.config.rds.route_config_name)).length > 0).length > 0)
      matchingFilterChains.length > 0 && 
        (l.matchingFilterChains = (l.matchingFilterChains||[]).concat(matchingFilterChains))
      return matchingFilterChains.length > 0
    }) : []
  }

  private static filterRoutesForClusters(routes: any[], clusters: any[]) {
    return routes ? routes.filter(route => {
      const routeClusters = route.routes.map(r => r.route && r.route.cluster).filter(c => c)
      return clusters.filter(c => routeClusters.includes(c.title)).length > 0
    }) : []
  }

  private static filterRoutesForListeners(routes: any[], listeners: any[]) {
    return routes ? routes.filter(route => 
      _.flatten(_.flatten(listeners.map(l => l.listener.filter_chains))
        .map(fc => fc.filters || []))
        .filter(f => f.config.rds && f.config.rds.route_config_name 
                && f.config.rds.route_config_name.includes(route.title)).length > 0
    ) : []
  }
}
