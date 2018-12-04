const jpExtract = require('../../util/jpExtract')

module.exports = {
  order: 4,
  context: "Pod",
  actions: [
    {
      name: "Get Pod Status",
      async act(getPods, onOutput) {
        const output = []
        const clusterPodsMap = await getPods()

        const clusters = Object.keys(clusterPodsMap)
        if(clusters.length === 0) {
          output.push(["No cluster selected"])
          onOutput(output, "Text")
          return
        }
        output.push(["", "", "", ""])
        clusters.forEach(cluster => {
          const clusterPods = clusterPodsMap[cluster]
          output.push(["Cluster:", cluster, "---", "---"])

          const namespaces = Object.keys(clusterPods)
          if(namespaces.length === 0) {
            output.push(["No namespaces selected", "", ""])
            return
          }

          namespaces.forEach(namespace => {
            output.push([">Namespace:", namespace, "---", "---"])

            const pods = clusterPods[namespace]
            if(pods.length === 0) {
              output.push(["No pods selected", "", "", ""])
              return
            }

            pods.forEach(pod => {
              const meta = jpExtract.extract(pod, "$.metadata", "name", "creationTimestamp")
              const containerStatuses = jpExtract.extract(pod, "$.status.containerStatuses[*]",
                                            "name", "state")
              containerStatuses.forEach(container => {
                output.push([
                  "Pod: " + meta[0].name,
                  "Created: " + meta[0].creationTimestamp,
                  "Container: " + container.name,
                  "Status: " + JSON.stringify(container.state)
                ])
              })
          })
        })
      })
      onOutput(output, "Health")
    }
  }
  ]
}
