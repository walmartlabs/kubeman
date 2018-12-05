const CommonFunctions = require('../../k8s/commonFunctions')
const generateServiceComparisonOutput = require('./namespaceCompareServices').generateServiceComparisonOutput

module.exports = {
  order: 2,
  context: "Cluster",
  actions: [
    {
      name: "Compare Services",
      order: 5,
      async act(getClusters, getK8sClients, onOutput) {
        const clusters = getClusters()
        const k8sClients = getK8sClients()

        const clusterServices = await CommonFunctions.getServicesGroupedByClusterNamespace(clusters, null, k8sClients)
        const namespaces = []
        Object.keys(clusterServices).map(cluster => Object.keys(clusterServices[cluster]))
        .forEach(cnamespaces => cnamespaces.forEach(namespace => 
          namespaces.push({name: namespace})))

        const output = generateServiceComparisonOutput(clusters, namespaces, clusterServices)
        onOutput(output, 'Compare')
      },
    },
  ]
}