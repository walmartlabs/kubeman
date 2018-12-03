const ClusterFunctions = require('../../k8s/clusterFunctions')


async function loadClusterServices(clusters, namespaces, k8sClients) {
  const clusterServices = {}
  for(let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i].name
    const k8sClient = k8sClients[i]
    clusterServices[cluster] = {}

    for(const j in namespaces) {
      if(namespaces[j].cluster.name === cluster) {
        const namespace = namespaces[j].name
        clusterServices[cluster][namespace] = await ClusterFunctions.getServicesForNamespace(namespace, k8sClient)
        //console.log("Cluster: %s, namespace: %s, services: %s", cluster, namespace, clusterServices[cluster][namespace])
      }
    }
  }
  return clusterServices
}

module.exports = {
  order: 3,
  context: "Namespace",
  actions: [
    {
      name: "Compare Services",
      async act(getClusters, getK8sClients, getNamespaces, onOutput) {
        const clusters = getClusters()
        const k8sClients = getK8sClients()
        const namespaces = getNamespaces()

        const clusterServices = await loadClusterServices(clusters, namespaces, k8sClients)

        const output = []
        const headers = ["Namespace/Service"]
        clusters.forEach(cluster => {
          headers.push("In " + cluster.name)
        })
        output.push(headers)

        const nsServiceToClusterMap = {}
        namespaces.forEach(ns => {
          const namespace = ns.name
          nsServiceToClusterMap[namespace] = {}
          Object.keys(clusterServices).forEach(cluster => {
            const clusterNSServices = clusterServices[cluster][namespace]
            clusterNSServices && 
              clusterNSServices.forEach(service => {
                if(!nsServiceToClusterMap[namespace][service]) {
                  nsServiceToClusterMap[namespace][service] = {}
                }
                nsServiceToClusterMap[namespace][service][cluster] = true
              })
          })
        })

        Object.keys(nsServiceToClusterMap).forEach(namespace => {
          output.push(["Namespace: " + namespace, "---", "---"])
          const serviceToClusterMap = nsServiceToClusterMap[namespace]
          Object.keys(serviceToClusterMap).forEach(service => {
            const clusterMap = serviceToClusterMap[service]
            const serviceRow = [service]
            clusters.forEach(cluster => {
              serviceRow.push(clusterMap[cluster.name] ? "Yes" : "No")
            })
            output.push(serviceRow)
          })
        })
        onOutput(output, "Compare")
      },
    }
  ]
}