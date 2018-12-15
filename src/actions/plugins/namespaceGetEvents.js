"use strict";
const k8sFunctions = require('../../k8s/k8sFunctions')

module.exports = {
  context: "Namespace",
  actions: [
    {
      name: "Get Events",
      order: 5,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()
        const namespaces = actionContext.getNamespaces()
        const output = []
        output.push([
          ["Event", "LastTimestamp", "(Count)"],
          "Details",
        ])
        for(const i in clusters) {
          const cluster = clusters[i]
          output.push(["Cluster: " + cluster.name, "---"])

          for(const j in namespaces) {
            const namespace = namespaces[j]
            if(namespace.cluster.name === cluster.name) {
              output.push([">Namespace: "+namespace.name, "---"])
              const events = await k8sFunctions.getNamespaceEvents(namespace.name, k8sClients[i])
              events.forEach(event => output.push([
                [event.reason, event.lastTimestamp, event.count ? "(" + event.count + ")" : ""],
                event.type ? [
                  "type: " + event.type,
                  "source: " + event.source,
                  "message: " + event.message,
                ] : [],
              ]))
            }
          }
        }
        actionContext.onOutput(output, 'Table')
      },
    },
  ]
}