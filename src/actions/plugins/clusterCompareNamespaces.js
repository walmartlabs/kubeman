"use strict";
const CommonFunctions = require('../../k8s/commonFunctions')

async function compareClusterNamespaces(cluster1, k8sClient1, cluster2, k8sClient2, output) {
  const namespaces1 = await CommonFunctions.getClusterNamespaces(cluster1, k8sClient1)
  const namespaces2 = await CommonFunctions.getClusterNamespaces(cluster2, k8sClient2)
  const allNamespaces = {}

  namespaces1.forEach(ns => allNamespaces[ns.name]=["Yes", "No"])
  namespaces2.forEach(ns => allNamespaces[ns.name]=
      [allNamespaces[ns.name]?allNamespaces[ns.name][0]:"No", "Yes"])

  Object.keys(allNamespaces).forEach(ns => output.push([ns, 
    allNamespaces[ns][0], allNamespaces[ns][1]]))
}

module.exports = {
  context: "Cluster",
  actions: [
    {
      order: 2,
      name: "Compare Namespaces",
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()

        if(clusters.length < 2 || k8sClients.length < 2) {
          actionContext.onOutput([["Not enough clusters to compare"]], 'Text')
          return
        }

        const output = []
        const cluster1 = clusters[0].name
        const cluster2 = clusters[1].name
        output.push(["Namespaces", "Cluster: " + cluster1, "Cluster: " + cluster2])
        await compareClusterNamespaces(cluster1, k8sClients[0], cluster2, k8sClients[1], output)
        actionContext.onOutput(output, 'Compare')
      },
    },
  ]
}