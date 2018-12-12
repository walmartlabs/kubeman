"use strict";
const k8sFunctions = require('../../k8s/k8sFunctions')


function generateServiceComparisonOutput(clusters, namespaces, clusterServices) {
  const output = []
  const headers = ["Namespace/Service"]
  clusters.forEach(cluster => {
    headers.push("Cluster: " + cluster.name)
  })
  output.push(headers)

  const nsServiceToClusterMap = {}
  namespaces.forEach(ns => {
    const namespace = ns.name
    if(!nsServiceToClusterMap[namespace]) {
      nsServiceToClusterMap[namespace] = {}
    }
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
    const services = serviceToClusterMap ? Object.keys(serviceToClusterMap) : []
    if(services.length === 0) {
      output.push(["No Services", "", ""])
    } else {
      services.forEach(service => {
        const clusterMap = serviceToClusterMap[service]
        const row = [service]
        clusters.forEach(cluster => {
          row.push(clusterMap[cluster.name] ? "Yes" : "No")
        })
        output.push(row)
      })
    }
  })
  return output
}

module.exports = {
  context: "Namespace",
  generateServiceComparisonOutput: generateServiceComparisonOutput,
  actions: [
    {
      name: "Compare Services",
      order: 1,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()
        const namespaces = actionContext.getNamespaces()

        const clusterServices = await k8sFunctions.getServicesGroupedByClusterNamespace(clusters, namespaces, k8sClients)

        const output = generateServiceComparisonOutput(clusters, namespaces, clusterServices)
        actionContext.onOutput(output, "Compare")
      },
    }
  ]
}