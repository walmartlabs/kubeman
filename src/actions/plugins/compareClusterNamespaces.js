const CommonFunctions = require('../../k8s/common')

async function compareClusterNamespaces(cluster1, k8sClient1, cluster2, k8sClient2, output) {
  const namespaces1 = await CommonFunctions.getNamespacesForCluster(cluster1, k8sClient1)
  const namespaces2 = await CommonFunctions.getNamespacesForCluster(cluster2, k8sClient2)
  const allNamespaces = {}

  namespaces1.forEach(ns => allNamespaces[ns.name]=["Yes", "No"])
  namespaces2.forEach(ns => allNamespaces[ns.name]=
      [allNamespaces[ns.name]?allNamespaces[ns.name][0]:"No", "Yes"])

  Object.keys(allNamespaces).forEach(ns => output.push([ns, 
    allNamespaces[ns][0], allNamespaces[ns][1]]))
}

module.exports = {
  order: 2,
  context: "Cluster",
  actions: [
    {
      order: 2,
      name: "Compare Namespaces",
      async act(getClusters, getK8sClients, onOutput) {
        const clusters = getClusters()
        const k8sClients = getK8sClients()
        const output = []
        if(clusters.length < 2 || k8sClients.length < 2) {
          output.push(["Not enough clusters to compare"])
          onOutput(output, 'Text')
        } else {
          const cluster1 = clusters[0].name
          const cluster2 = clusters[1].name
          output.push(["Namespaces", "In " + cluster1, "In " + cluster2])
          await compareClusterNamespaces(cluster1, k8sClients[0], cluster2, k8sClients[1], output)
          onOutput(output, 'Compare')
        }
      },
    },
  ]
}