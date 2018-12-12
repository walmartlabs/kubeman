const jsonUtil = require('../util/jsonUtil')


const k8sFunctions = {

  extractMetadata(data) {
    const prettifyLabels = (meta) => {
      if(meta.labels) {
        meta.labels = jsonUtil.convertObjectToArray(meta.labels)
      }
    }
    const metaFields = ["name", "creationTimestamp", "labels"]
    if(data instanceof Array) {
      const metas = jsonUtil.extractMulti(data, "$[*].metadata", ...metaFields)
      metas.forEach(prettifyLabels)
      return metas
    } else {
      const meta = jsonUtil.extract(data, "$.metadata", ...metaFields)
      prettifyLabels(meta)
      return meta
    }
  },

  async getClusterNodes(cluster, k8sClient) {
    const nodes = []
    const result = await k8sClient.nodes.get()
    if(result && result.body) {
      const items = result.body.items
      items.forEach(item => {
        const meta = this.extractMetadata(item)
        const spec = jsonUtil.extract(item, "$.spec", "podCIDR")
        const status = jsonUtil.extract(item, "$.status", "addresses", "conditions", "nodeInfo")
        const node = {
          ...meta,
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
      const meta = this.extractMetadata(items)
      const status = jsonUtil.extractMulti(items, "$[*].status", "phase")
      meta.forEach((item, index) => {
        namespaceList.push({
          ...item,
          status: status[index].phase,
        })
      })
    }
    return namespaceList
  },

  async getNamespaceServiceNames(namespace, k8sClient) {
    const services = []
    const result = await k8sClient.namespaces(namespace).services.get()
    if(result && result.body) {
      const items = result.body.items
      const meta = this.extractMetadata(items)
      meta.forEach((item, index) => {
        services.push(item.name)
      })
    }
    return services
  },

  async getNamespaceServices(namespace, k8sClient) {
    const services = []
    const result = await k8sClient.namespaces(namespace).services.get()
    if(result && result.body) {
      const items = result.body.items
      const metas = this.extractMetadata(items)
      const specs = jsonUtil.extract(items, "$[*].spec")
      const statuses = jsonUtil.extract(items, "$[*].status")
      specs.forEach((spec, index) => {
        services.push({
          ...metas[index],
          clusterIP: spec.clusterIP,
          externalIPs: spec.externalIPs,
          externalName: spec.externalName,
          externalTrafficPolicy: spec.externalTrafficPolicy,
          healthCheckNodePort: spec.healthCheckNodePort,
          loadBalancerIP: spec.loadBalancerIP,
          loadBalancerSourceRanges: spec.loadBalancerSourceRanges,
          ports: spec.ports,
          publishNotReadyAddresses: spec.publishNotReadyAddresses,
          selector: jsonUtil.convertObjectToArray(spec.selector),
          sessionAffinity: spec.sessionAffinity,
          sessionAffinityConfig: spec.sessionAffinityConfig,
          type: spec.type,
          loadBalancer: statuses.loadBalancer,
        })
      })
    }
    return services
  },

  async getClusterServices(cluster, k8sClient) {
    const namespaces = await this.getClusterNamespaces(cluster, k8sClient)
    const services = {}
    for(const i in namespaces) {
      services[namespaces[i].name] = await this.getNamespaceServiceNames(namespaces[i].name, k8sClient)
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
            services[cluster][namespace] = await this.getNamespaceServiceNames(namespace, k8sClient)
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
      const meta = this.extractMetadata(items)
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
      const metas = this.extractMetadata(items)
      items.forEach((item, index) => {
        const secret = {
          ...metas[index],
          type: item.type,
          kind: item.kind,
          stringData: item.stringData,
        }
        secret.name = secret.name.slice(0, secret.name.lastIndexOf('-'))
        secrets.push(secret)
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

  async getPodDetails(namespace, pod, k8sClient) {
    const podDetails = await k8sClient.namespace(namespace).pods(pod).get()
    return podDetails ? podDetails.body : undefined
  },

  processEventsData(result) {
    const events = []
    if(result && result.body) {
      const items = result.body.items
      if(items.length > 0) {
        const eventsData = jsonUtil.extractMulti(items, "$[*]", "type", "source", "reason", "message", "count", "lastTimestamp")
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
k8sFunctions.extractMetadata = k8sFunctions.extractMetadata.bind(k8sFunctions)
k8sFunctions.getNamespaceSecrets = k8sFunctions.getNamespaceSecrets.bind(k8sFunctions)
k8sFunctions.getNamespaceServices = k8sFunctions.getNamespaceServices.bind(k8sFunctions)

module.exports = k8sFunctions