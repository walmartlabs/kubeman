"use strict";
const k8sFunctions = require('../../k8s/k8sFunctions')

module.exports = {
  context: "Cluster",
  actions: [
    {
      name: "Get Events",
      order: 3,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()
        const output = []
        output.push([
          ["Event", "LastTimestamp", "(Count)"],
          "Details",
        ])
        for(const i in clusters) {
          const cluster = clusters[i].name
          output.push(["Cluster: " + cluster, "---", "---"])
          const events = await k8sFunctions.getClusterEvents(cluster, k8sClients[i])
          events.forEach(event => output.push([
            [event.reason, event.lastTimestamp, event.count ? "(" + event.count + ")" : ""],
            event.type ? [
              "type: " + event.type,
              "source: " + event.source,
              "message: " + event.message,
            ] : [],
      ]))
        }
        actionContext.onOutput(output, 'Table')
      },
    },
  ]
}