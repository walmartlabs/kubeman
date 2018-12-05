const CommonFunctions = require('../../k8s/commonFunctions')

module.exports = {
  order: 2,
  context: "Namespace",
  actions: [
    {
      name: "Get Events",
      order: 5,
      async act(getClusters, getNamespaces, getK8sClients, onOutput) {
        const clusters = getClusters()
        const k8sClients = getK8sClients()
        const namespaces = getNamespaces()
        const output = []
        output.push([
          "Event <br/> Last Timestamp (Count)", 
          "Details",
        ])
        for(const i in clusters) {
          const cluster = clusters[i]
          output.push(["Cluster: " + cluster.name, "---"])

          for(const j in namespaces) {
            const namespace = namespaces[j]
            if(namespace.cluster.name === cluster.name) {
              output.push([">Namespace: "+namespace.name, "---"])
              const events = await CommonFunctions.getNamespaceEvents(namespace.name, k8sClients[i])
              events.forEach(event => output.push([
                event.reason + " <br/> " + event.lastTimestamp + " (" + event.count + ")",
                [
                  "type: " + event.type,
                  "source: " + event.source,
                  "message: " + event.message,
                ],
              ]))
            }
          }
        }
        onOutput(output, 'Table')
      },
    },
  ]
}