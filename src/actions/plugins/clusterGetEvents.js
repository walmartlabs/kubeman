const CommonFunctions = require('../../k8s/commonFunctions')

module.exports = {
  order: 2,
  context: "Cluster",
  actions: [
    {
      name: "Get Events",
      order: 3,
      async act(getClusters, getK8sClients, onOutput) {
        const clusters = getClusters()
        const k8sClients = getK8sClients()
        const output = []
        output.push([
          "Event <br/> Last Timestamp (Count)", 
          "Details",
        ])
        for(const i in clusters) {
          const cluster = clusters[i].name
          output.push(["Cluster: " + cluster, "---", "---"])
          const events = await CommonFunctions.getClusterEvents(cluster, k8sClients[i])
          events.forEach(event => output.push([
            event.reason + " <br/> " + event.lastTimestamp + " (" + event.count + ")",
            [
              "type: " + event.type,
              "source: " + event.source,
              "message: " + event.message,
            ],
          ]))
        }
        onOutput(output, 'Table')
      },
    },
  ]
}