const jpExtract = require('../util/jpExtract')
module.exports = {

  async getClusterNodes(cluster, k8sClient) {
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
  
  async getClusterNamespaces(cluster, k8sClient) {
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

  async getNamespaceServices(namespace, k8sClient) {
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

  async getClusterServices(cluster, k8sClient) {
    const namespaces = await this.getClusterNamespaces(cluster, k8sClient)
    const services = {}
    for(const i in namespaces) {
      services[namespaces[i].name] = await this.getNamespaceServices(namespaces[i].name, k8sClient)
    }
    return services
  },

  async getServicesGroupedByClusterNamespace(clusters, namespaces, k8sClients) {
    const services = {}
    for(const i in clusters) {
      const cluster = clusters[i].name
      const k8sClient = k8sClients[i]
      services[cluster] = {}

      if(!namespaces || namespaces.length === 0) {
        services[cluster] = await this.getClusterServices(cluster, k8sClient)
      } else {
        for(const j in namespaces) {
          if(namespaces[j].cluster.name === cluster) {
            const namespace = namespaces[j].name
            services[cluster][namespace] = await this.getNamespaceServices(namespace, k8sClient)
          }
        }
      }
    }
    return services
  },

  async getDeploymentsForNamespace(namespace, k8sClient) {
    const deployments = []
    const result = await k8sClient.namespaces(namespace).deployments.get()
    if(result && result.body) {
      const items = result.body.items
      const meta = jpExtract.extractMulti(items, "$[*].metadata", "name", "creationTimestamp")
      meta.forEach((item, index) => {
        deployments.push(item.name)
      })
    }
    return deployments
  },

  async getDeploymentsForCluster(cluster, k8sClient) {
    const namespaces = await this.getClusterNamespaces(cluster, k8sClient)
    const deployments = {}
    for(const i in namespaces) {
      deployments[namespaces[i].name] = await this.getDeploymentsForNamespace(namespaces[i].name, k8sClient)
    }
    return deployments
  },

  async getDeploymentsGroupedByClusterNamespace(clusters, namespaces, k8sClients) {
    const deployments = {}
    for(const i in clusters) {
      const cluster = clusters[i].name
      const k8sClient = k8sClients[i]
      deployments[cluster] = {}

      if(!namespaces || namespaces.length === 0) {
        deployments[cluster] = await this.getDeploymentsForCluster(cluster, k8sClient)
      } else {
        for(const j in namespaces) {
          if(namespaces[j].cluster.name === cluster) {
            const namespace = namespaces[j].name
            deployments[cluster][namespace] = await this.getDeploymentsForNamespace(namespace, k8sClient)
          }
        }
      }
    }
    return deployments
  },

  async getNamespaceSecrets(namespace, k8sClient) {
    const secrets = []
    const result = await k8sClient.namespaces(namespace).secrets.get()
    if(result && result.body) {
      const items = result.body.items
      const meta = jpExtract.extractMulti(items, "$[*].metadata", "name", "creationTimestamp")
      meta.forEach((item, index) => {
        secrets.push({
          name: item.name,
          creationTimestamp: item.creationTimestamp,
          type: items[index].type,
        })
      })
    }
    return secrets
  },

  async getNamespacePods(namespace, podNames, k8sClient) {
    const pods = []
    for(const p in podNames) {
      const podDetails = await k8sClient.namespace(namespace).pods(podNames[p]).get()
      podDetails && pods.push(podDetails.body)
    }
    return pods
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

  async getPodEvents(namespace, pod, k8sClient) {
    return this.processEventsData(await k8sClient.namespaces(namespace).events.get({
      qs: {
        limit: 20,
        fieldSelector: {
          involvedObject: {
            name: pod
          }
        },
      }
    }))
  },
  
}