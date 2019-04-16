import _ from 'lodash'
import {K8sClient} from './k8sClient'
import K8sFunctions from '../k8s/k8sFunctions'
import {getUniqueResourcesByField, FqdnMatcher} from '../util/matchUtil'

export enum EnvoyConfigType {
  Bootstrap = "BootstrapConfig",
  Clusters = "ClustersConfig",
  Listeners = "ListenersConfig",
  Routes = "RoutesConfig"
}

export default class EnvoyFunctions {
  static getFqdnFromCluster = (cluster: string) => {
    const parts = cluster.includes("|") ? cluster.split("|") : cluster.split("_.")
    return parts[parts.length-1]
  }

  static async getEnvoyConfigDump(k8sClient: K8sClient, namespace: string, pod: string, container: string) : Promise<any[]> {
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
    return []
  }


  private static extractEnvoyConfigForType(configs: any[], configType: EnvoyConfigType) : any[] {
    configs = configs.filter(c => c["@type"].includes(configType))[0]

    const bootstrapConfig = configs[Object.keys(configs).filter(key => key.includes("bootstrap"))[0]]
    const staticItems = configs[Object.keys(configs).filter(key => key.includes("static"))[0]]
    const dynamicItems = configs[Object.keys(configs).filter(key => key.includes("dynamic"))[0]]

    const items: any[] = []
    bootstrapConfig && items.push(bootstrapConfig)
    staticItems && staticItems.forEach(item => item && items.push(item))
    dynamicItems && dynamicItems.forEach(item => item && items.push(item))
    return items
  }

  static async getEnvoyConfigForType(k8sClient: K8sClient, namespace: string, pod: string, container: string, 
                                      configType: EnvoyConfigType) : Promise<any[]> {
    try {
      let configs = await EnvoyFunctions.getEnvoyConfigDump(k8sClient, namespace, pod, container)
      return EnvoyFunctions.extractEnvoyConfigForType(configs, configType)
    } catch(error) {
      console.log(error)
    }
    return []
  }

  private static prepareEnvoyBootstrapConfig(configs: any[]) {
    return configs.map(config => {
      config.title = config.node.id
      return config
    })
  }

  private static async prepareEnvoyClustersConfig(clusterConfigs: any[], namespace: string, pod: string, container: string, k8sClient: K8sClient) {
    const result = JSON.parse(await K8sFunctions.podExec(namespace, pod, container, k8sClient, 
                                  ["curl", "-s", "http://127.0.0.1:15000/clusters?format=json"]))
    const clusterStatusMap = {}
    result.cluster_statuses && result.cluster_statuses.forEach &&
      result.cluster_statuses.forEach(cs => clusterStatusMap[cs.name] = cs)

    clusterConfigs.forEach(config => {
      config.title = config.cluster.name
      const clusterStatus = clusterStatusMap[config.name]
      if(clusterStatus) {
        delete clusterStatus.name
        config.status = clusterStatus
      }
    })
    return clusterConfigs
  }

  private static prepareEnvoyListenersConfig(listenersConfigs: any[]) {
    return listenersConfigs.map(config => {
      config.title = config.listener.address.socket_address.address+":"+config.listener.address.socket_address.port_value
      return config
    })
}

  private static prepareEnvoyRoutesConfig(routesConfigs: any[]) {
    return _.flatten(routesConfigs.map(r => 
      r.route_config.virtual_hosts.map(vh => {
        vh.title = vh.name
        r.route_config.name && (vh.title = r.route_config.name + " > " + vh.name)
        return vh
      })))
  }

  static async getEnvoyBootstrapConfig(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    return EnvoyFunctions.prepareEnvoyBootstrapConfig(
          await EnvoyFunctions.getEnvoyConfigForType(k8sClient, namespace, pod, container, EnvoyConfigType.Bootstrap))
  }

  static async getEnvoyClusters(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    return EnvoyFunctions.prepareEnvoyClustersConfig(
        await EnvoyFunctions.getEnvoyConfigForType(k8sClient, namespace, pod, container, EnvoyConfigType.Clusters),
        namespace, pod, container, k8sClient)
  }

  static async gettEnvoyListeners(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    return EnvoyFunctions.prepareEnvoyListenersConfig(
            await EnvoyFunctions.getEnvoyConfigForType(k8sClient, namespace, pod, container, EnvoyConfigType.Listeners))
  }

  static async gettEnvoyRoutes(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    return EnvoyFunctions.prepareEnvoyRoutesConfig(
            await EnvoyFunctions.getEnvoyConfigForType(k8sClient, namespace, pod, container, EnvoyConfigType.Routes))
  }

  static async getAllEnvoyConfigs(k8sClient: K8sClient, namespace: string, pod: string, container: string) : Promise<Object> {
    try {
      let configs = await EnvoyFunctions.getEnvoyConfigDump(k8sClient, namespace, pod, container)
      const configsByType = {}
      configsByType[EnvoyConfigType.Clusters] = await EnvoyFunctions.prepareEnvoyClustersConfig(
                      EnvoyFunctions.extractEnvoyConfigForType(configs, EnvoyConfigType.Clusters),
                      namespace, pod, container, k8sClient)
      configsByType[EnvoyConfigType.Listeners] = EnvoyFunctions.prepareEnvoyListenersConfig(
                      EnvoyFunctions.extractEnvoyConfigForType(configs, EnvoyConfigType.Listeners))
      configsByType[EnvoyConfigType.Routes] = EnvoyFunctions.prepareEnvoyRoutesConfig(
                      EnvoyFunctions.extractEnvoyConfigForType(configs, EnvoyConfigType.Routes))
      return configsByType
    } catch(error) {
      console.log(error)
    }
    return {}
  }

  static async getEnvoyStats(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    return K8sFunctions.podExec(namespace, pod, container, k8sClient, 
                                ["curl", "-s", "http://127.0.0.1:15000/stats"])
  }

  static async getEnvoyServerInfo(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    return JSON.parse(await K8sFunctions.podExec(namespace, pod, container, k8sClient, 
                                ["curl", "-s", "http://127.0.0.1:15000/server_info"]))
  }

  static async listEnvoyListeners(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    return JSON.parse(await K8sFunctions.podExec(namespace, pod, container, k8sClient, 
                                ["curl", "-s", "http://127.0.0.1:15000/listeners"]))
  }

  static async getEnvoyListenerPorts(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
    return (await EnvoyFunctions.listEnvoyListeners(k8sClient, namespace, pod, container))
            .map(l => l.split(":")[1]).filter(p => p).map(p => parseInt(p))
  }

  static async getEnvoyLoadedCerts(k8sClient: K8sClient, namespace: string, pod: string, container: string) {
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
        l.listener['filter_chains(matches)'] = l.matchingFilterChains
        delete l.listener.filter_chains
        delete l.matchingFilterChains
      }
      return l
    })
    return configsByType
  }

  private static filterClustersForFqdn(clusters: any[]) {
    const nameMatches = clusters.filter(c => FqdnMatcher.matchDomain(EnvoyFunctions.getFqdnFromCluster(c.cluster.name)))
    const hostMatches = clusters
      .filter(c => c.cluster.hosts && 
        c.cluster.hosts.filter(h => FqdnMatcher.matchDomain(h.socket_address.address)).length > 0)

    const lbEndpointMatches = clusters
      .filter(c => c.cluster.load_assignment)
      .filter(c => {
        const endpoints = _.flatten(c.cluster.load_assignment.endpoints.map(e => e.lb_endpoints))
                            .map(e => e.endpoint.address.socket_address.address)
        return endpoints.filter(e => FqdnMatcher.matchDomain(e)).length > 0
      })
    return getUniqueResourcesByField("title", nameMatches, hostMatches, lbEndpointMatches)
  }

  private static filterListenersByDomainMatch(listeners: any[]) {
    return listeners.filter(l => {
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
    })
  }

  private static filterListenersByClusterMatch(listeners: any[]) {
    return listeners.filter(l => {
      const matchingFilterChains = l.listener.filter_chains.filter(fc =>
        fc.filters && fc.filters.filter(f => f.config.cluster && 
          FqdnMatcher.matchDomain(EnvoyFunctions.getFqdnFromCluster(f.config.cluster))).length > 0)
      matchingFilterChains.length > 0 && 
        (l.matchingFilterChains = (l.matchingFilterChains||[]).concat(matchingFilterChains))
      return matchingFilterChains.length > 0
    })
  }

  private static filterRoutesByDomainMatch(routes: any[]) {
    return routes.filter(r => {
      return r.domains && r.domains.filter(domain => FqdnMatcher.matchDomain(domain)).length > 0
    })
  }

  private static filterRoutesByClusterMatch(routes: any[]) {
    return routes.filter(r => {
      return r.routes && r.routes.filter(rt => rt.route.cluster)
        .filter(rt => FqdnMatcher.matchDomain(EnvoyFunctions.getFqdnFromCluster(rt.route.cluster))).length > 0
    })
  }

  private static filterClustersForListeners(clusters: any[], listeners: any[]) {
    return clusters.filter(c =>
      _.flatten(_.flatten(listeners.filter(l => l.matchingFilterChains && l.matchingFilterChains.length > 0)
                    .map(l => l.matchingFilterChains))
                .map(fc => fc.filters || []))
        .map(f => f.config.cluster)
        .filter(c => c)
        .filter(lc => c.title === lc)
        .length > 0)
  }

  private static filterClustersForRoutes(clusters: any[], routes: any[]) {
    return clusters.filter(c =>
      _.flatten(routes.map(r => r.routes))
        .map(r => r.route && r.route.cluster)
        .filter(c => c)
        .filter(lc => c.title === lc)
        .length > 0)
  }

  private static filterListenersForClusters(listeners: any[], clusters: any[]) {
    return listeners.filter(l => {
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
    })
  }

  private static filterListenersForRoutes(listeners: any[], routes: any[]) {
    return listeners.filter(l => {
      const matchingFilterChains = l.listener.filter_chains.filter(fc =>
        fc.filters && fc.filters.filter(f => f.config.rds && 
            routes.filter(r => r.title.includes(f.config.rds.route_config_name)).length > 0).length > 0)
      matchingFilterChains.length > 0 && 
        (l.matchingFilterChains = (l.matchingFilterChains||[]).concat(matchingFilterChains))
      return matchingFilterChains.length > 0
    })
  }

  private static filterRoutesForClusters(routes: any[], clusters: any[]) {
    return routes.filter(route => {
      const routeClusters = route.routes.map(r => r.route && r.route.cluster).filter(c => c)
      return clusters.filter(c => routeClusters.includes(c.title)).length > 0
    })
  }

  private static filterRoutesForListeners(routes: any[], listeners: any[]) {
    return routes.filter(route => 
      _.flatten(_.flatten(listeners.map(l => l.listener.filter_chains))
        .map(fc => fc.filters || []))
        .filter(f => f.config.rds && f.config.rds.route_config_name 
                && f.config.rds.route_config_name.includes(route.title)).length > 0
    )
  }
}
