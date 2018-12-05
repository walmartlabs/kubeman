const jpExtract = require('../util/jpExtract')
module.exports = {

  async getNodesForCluster(cluster, k8sClient) {
    const nodes = []
    const result = await k8sClient.nodes.get()
    if(result && result.body) {
      const items = result.body.items
      items.forEach(item => {
        const meta = jpExtract.extract(item, "$.metadata", "name", "creationTimestamp")
        const spec = jpExtract.extract(item, "$.spec", "podCIDR")
        const status = jpExtract.extract(item, "$.status", "addresses", "conditions", "nodeInfo")
        const node = {
          name: meta.name,
          creationTimestamp: meta.creationTimestamp,
          network: {
            ip: spec.podCIDR,
          },
          condition: {},
          info: {
            osImage: status.nodeInfo.osImage,
            containerRuntimeVersion: status.nodeInfo.containerRuntimeVersion,
            kubeletVersion: status.nodeInfo.kubeletVersion,
            kubeProxyVersion: status.nodeInfo.kubeProxyVersion,
          }
        }
        status.addresses.forEach(a => node.network[a.type] = a.address)
        status.conditions.forEach(c => node.condition[c.type] = {status:c.status, message:c.message})
        nodes.push(node)
      })
      return nodes
    }
  },
  
  async getNamespacesForCluster(cluster, k8sClient) {
    const namespaceList = []
    const result = await k8sClient.namespaces.get()
    if(result && result.body) {
      const items = result.body.items
      const meta = jpExtract.extract(items, "$[*].metadata", "name", "creationTimestamp")
      const status = jpExtract.extract(items, "$[*].status", "phase")
      meta.forEach((item, index) => {
        namespaceList.push({
          name: item.name, 
          creationTimestamp: item.creationTimestamp,
          status: status[index].phase,
        })
      })
    }
    return namespaceList
  },


  async getServicesForNamespace(namespace, k8sClient) {
    const services = []
    const result = await k8sClient.namespaces(namespace).services.get()
    if(result && result.body) {
      const items = result.body.items
      const meta = jpExtract.extractMulti(items, "$[*].metadata", "name", "creationTimestamp")
      meta.forEach((item, index) => {
        services.push(item.name)
      })
    }
    return services
  },


  async getServicesForCluster(cluster, k8sClient) {
    const namespaces = await this.getNamespacesForCluster(cluster, k8sClient)
    const services = {}
    for(const i in namespaces) {
      services[namespaces[i].name] = await this.getServicesForNamespace(namespaces[i].name, k8sClient)
    }
    return services
  },


  async getServicesGroupedByClusterNamespace(clusters, namespaces, k8sClients) {
    const clusterServices = {}
    for(const i in clusters) {
      const cluster = clusters[i].name
      const k8sClient = k8sClients[i]
      clusterServices[cluster] = {}

      if(!namespaces || namespaces.length === 0) {
        clusterServices[cluster] = await this.getServicesForCluster(cluster, k8sClient)
      } else {
        for(const j in namespaces) {
          if(namespaces[j].cluster.name === cluster) {
            const namespace = namespaces[j].name
            clusterServices[cluster][namespace] = await this.getServicesForNamespace(namespace, k8sClient)
          }
        }
      }
    }
    return clusterServices
  },

  processEventsData(result) {
    const events = []
    if(result && result.body) {
      const items = result.body.items
      if(items.length > 0) {
        const eventsData = jpExtract.extract(items, "$[*]", "type", "source", "reason", "message", "count", "lastTimestamp")
        eventsData.forEach(event => {
          events.push({
            reason: event.reason,
            type: event.type, 
            source: event.source.component, 
            message: event.message,
            count: event.count,
            lastTimestamp: event.lastTimestamp,
          })
        })
      } else {
        events.push({
          reason: "No Events",
          type: "", 
          source: "", 
          message: "",
          count: "",
          lastTimestamp: "",
        })
      }
    }
    return events
  },

  async getClusterEvents(cluster, k8sClient) {
    return this.processEventsData(await k8sClient.events.get({qs: {limit: 20}}))
  },

  async getNamespaceEvents(namespace, k8sClient) {
    return this.processEventsData(await k8sClient.namespaces(namespace).events.get({qs: {limit: 20}}))
  },
  
}