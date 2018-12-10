"use strict";
const CommonFunctions = require('../../k8s/commonFunctions')

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
          const namespaces = await CommonFunctions.getClusterNamespaces(cluster, k8sClients[i])
          namespaces.forEach(ns => output.push([ns.name, ns.creationTimestamp, ns.status]))
        }
        actionContext.onOutput(output, 'Health')
      }
    },
  ]
}