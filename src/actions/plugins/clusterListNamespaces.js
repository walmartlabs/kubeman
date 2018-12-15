"use strict";
const k8sFunctions = require('../../k8s/k8sFunctions')

module.exports = {
  context: "Cluster",
  actions: [
    {
      order: 1,
      name: "List Namespaces",
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()
        const output = []
        output.push([
          "Namespace", 
          "Created",
          "Status"
        ])
        for(const i in clusters) {
          const cluster = clusters[i].name
          output.push(["Cluster: " + cluster, "---", "---"])
          const namespaces = await k8sFunctions.getClusterNamespaces(cluster, k8sClients[i])
          namespaces.forEach(ns => output.push([ns.name, ns.creationTimestamp, ns.status]))
        }
        actionContext.onOutput(output, 'Table')
      }
    },
  ]
}