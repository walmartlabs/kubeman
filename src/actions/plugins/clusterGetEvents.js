"use strict";
const CommonFunctions = require('../../k8s/commonFunctions')

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
          const events = await CommonFunctions.getClusterEvents(cluster, k8sClients[i])
          events.forEach(event => output.push([
            [event.reason, event.lastTimestamp, "(" + event.count + ")"],
            [
              "type: " + event.type,
              "source: " + event.source,
              "message: " + event.message,
            ],
          ]))
        }
        actionContext.onOutput(output, 'Health')
      },
    },
  ]
}