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
    for(const ns in namespaces) {
      services[ns.name] = await this.getServicesForNamespace(ns, k8sClient)
    }
    return services
  },

}