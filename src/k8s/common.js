const jpExtract = require('../util/jpExtract')
module.exports = {
  async getNamespacesForCluster(cluster, k8sClient) {
    const namespaceList = []
    const namespaces = await k8sClient.namespaces.get()
    if(namespaces && namespaces.body) {
      const items = namespaces.body.items
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
    const nsServices = await k8sClient.namespaces(namespace).services.get()
    if(nsServices && nsServices.body) {
      const items = nsServices.body.items
      const meta = jpExtract.extract(items, "$[*].metadata", "name", "creationTimestamp")
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
  }
  
}