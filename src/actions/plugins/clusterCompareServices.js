"use strict";
const CommonFunctions = require('../../k8s/commonFunctions')
const generateServiceComparisonOutput = require('./namespaceCompareServices').generateServiceComparisonOutput

module.exports = {
  context: "Cluster",
  actions: [
    {
      name: "Compare Services",
      order: 5,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()

        if(clusters.length < 2 || k8sClients.length < 2) {
          actionContext.onOutput([["Not enough clusters to compare"]], 'Text')
          return
        }

        const clusterServices = await CommonFunctions.getServicesGroupedByClusterNamespace(clusters, null, k8sClients)
        const namespaces = []
        Object.keys(clusterServices).map(cluster => Object.keys(clusterServices[cluster]))
        .forEach(cnamespaces => cnamespaces.forEach(namespace => 
          namespaces.push({name: namespace})))

        const output = generateServiceComparisonOutput(clusters, namespaces, clusterServices)
        actionContext.onOutput(output, 'Compare')
      },
    },
  ]
}