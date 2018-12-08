const CommonFunctions = require('../../k8s/commonFunctions')

function generatePodEventsOutput(podsMap) {
  const output = []
  output.push([
    "Event <br/> Last Timestamp <br/> (Count)", 
    "Details"
  ])

  Object.keys(podsMap).forEach(cluster => {
    const namespaces = Object.keys(podsMap[cluster])
    namespaces.forEach(namespace => {
      output.push(["Cluster: "+cluster + ", Namespace: "+namespace, "---", "---"])

      const pods = Object.keys(podsMap[cluster][namespace])
      if(pods.length === 0) {
        output.push(["No pods selected", "", ""])
      } else {
        pods.forEach(pod => {
          output.push([">Pod: "+pod, "---", "---"])
          const events = podsMap[cluster][namespace][pod]
          events.forEach(event => output.push([
            event.reason + " <br/> " + event.lastTimestamp + " <br/> (" + event.count + ")",
            [
              "type: " + event.type,
              "source: " + event.source,
              "message: " + event.message,
            ],
          ]))
        })
      }
    })
  })
  return output
}


module.exports = {
  order: 4,
  context: "Pod",
  actions: [
    {
      name: "Get Pod Events",
      async act(getClusters, getNamespaces, getPods, getK8sClients, onOutput) {
        const clusters = getClusters()
        const namespaces = getNamespaces()
        const pods = getPods()
        const k8sClients = getK8sClients()

        if(clusters.length === 0) {
          onOutput([["No cluster selected"]], "Text")
          return
        }
        if(namespaces.length === 0) {
          onOutput([["No namespace selected"]], "Text")
          return
        }
        if(pods.length === 0) {
          onOutput([["No pods selected"]], "Text")
          return
        }

        const podsMap = {}
        for(const c in clusters) {
          const cluster = clusters[c]
          podsMap[cluster.name] = {}
          const clusterNamespaces = namespaces.filter(ns => ns.cluster.name === cluster.name)
          for(const n in clusterNamespaces) {
            const namespace = clusterNamespaces[n]
            podsMap[cluster.name][namespace.name] = {}

            const podNames = pods.filter(pod => pod.namespace.cluster.name === cluster.name)
                          .filter(pod => pod.namespace.name === namespace.name)
                          .map(pod => pod.name)
            for(const p in podNames) {
              const pod = podNames[p]
              podsMap[cluster.name][namespace.name][pod] = 
                  await CommonFunctions.getPodEvents(namespace.name, pod, k8sClients[c])
              const output = generatePodEventsOutput(podsMap)
              onOutput(output, "Health")
            }
          }
        }
      }
    }
  ]
}
