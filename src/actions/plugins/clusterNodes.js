"use strict";
const k8sFunctions = require('../../k8s/k8sFunctions')

module.exports = {
  context: "Cluster",
  actions: [
    {
      name: "Get Nodes Details",
      order: 4,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()
        const output = []
        output.push([
          ["Node", "(CreationTime)"],
          "Info",
          "Conditions",
        ])
        for(const i in clusters) {
          const cluster = clusters[i].name
          output.push(["Cluster: " + cluster, "---", "---"])
          const nodes = await k8sFunctions.getClusterNodes(cluster, k8sClients[i])
          nodes.forEach(node => output.push([
            [node.name, "(" + node.creationTimestamp + ")"],
            Object.keys(node.network)
                  .map(key => key + ": " + node.network[key])
                  .concat(Object.keys(node.info)
                      .map(key => key + ": " + node.info[key])),
            Object.keys(node.condition).map(key => 
                  key + ": " + node.condition[key].status +
                  " (" + node.condition[key].message + ")"),
          ]))
        }
        actionContext.onOutput(output, 'Health')
      },
    },
  ]
}