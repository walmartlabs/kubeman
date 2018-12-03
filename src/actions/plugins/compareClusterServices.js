const ClusterFunctions = require('../../k8s/clusterFunctions')

async function compareClusterServices(cluster1, k8sClient1, cluster2, k8sClient2, output) {
  const services1 = await ClusterFunctions.getServicesForCluster(cluster1, k8sClient1)
  const services2 = await ClusterFunctions.getServicesForCluster(cluster2, k8sClient2)

  console.log("services1 " + JSON.stringify(services1))
  console.log("services2 " + JSON.stringify(services2))

  Object.keys(services1).forEach(ns1 => {
    output.push([ns1, "---", "---"])
    const serviceComparisonMap = {}
    const nsServices1 = services1[ns1]
    const nsServices2 = services2[ns1]
    nsServices1.forEach(s => serviceComparisonMap[s.name]=["Yes", "No"])
    nsServices2 && nsServices2.forEach(s => serviceComparisonMap[s.name]=
      [serviceComparisonMap[s.name]?serviceComparisonMap[s.name][0]:"No", "Yes"])
    Object.keys(serviceComparisonMap).forEach(s => output.push([s, 
      serviceComparisonMap[s][0], serviceComparisonMap[s][1]]))
      nsServices2 && delete services2[ns1]
  })
  Object.keys(services2).forEach(ns2 => {
    output.push([ns2, "---", "---"])
    const nsServices2 = services2[ns2]
    nsServices2.forEach(s => output.push([s.name, "No", "Yes"]))
  })
}

module.exports = {
  order: 2,
  context: "Cluster",
  actions: [
    {
      name: "Compare Services",
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
          output.push(["", "In " + cluster1, "In " + cluster2])
          await compareClusterServices(cluster1, k8sClients[0], cluster2, k8sClients[1], output)
          onOutput(output, 'Compare')
        }
      },
    },
  ]
}