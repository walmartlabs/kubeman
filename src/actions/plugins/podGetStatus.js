"use strict";
const jsonUtil = require('../../util/jsonUtil')
const k8sFunctions = require('../../k8s/k8sFunctions')

function generatePodStatusOutput(podsMap) {
  const output = []
  output.push(["Pod", "Created", "Container Status"])

  Object.keys(podsMap).forEach(cluster => {
    output.push(["Cluster: "+cluster, "---", "---"])

    const namespaces = Object.keys(podsMap[cluster])
    namespaces.forEach(namespace => {
      output.push([">Namespace: "+namespace, "---", "---"])

      const pods = podsMap[cluster][namespace]
      if(pods.length === 0) {
        output.push(["No pods selected", "", ""])
      } else {
        pods.forEach(pod => {
          const meta = jsonUtil.extract(pod, "$.metadata", "name", "creationTimestamp")
          const containerStatuses = jsonUtil.extractMulti(pod, "$.status.containerStatuses[*]",
                                        "name", "state")
          const containerStatusTable = []
          containerStatuses.forEach(container => {
            containerStatusTable.push(
              container.name + ": " + 
              Object.keys(container.state).map(state => state + ", " + 
                  Object.keys(container.state[state])
                    .map(started => started + " " + container.state[state][started])
                    .join(" ")
                ).join(" ")
            )
          })
          output.push([meta.name, meta.creationTimestamp, containerStatusTable])
        })
      }
    })
  })
  return output
}


module.exports = {
  context: "Pod",
  actions: [
    {
      name: "Get Pod Status",
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const namespaces = actionContext.getNamespaces()
        const pods = actionContext.getPods()
        const k8sClients = actionContext.getK8sClients()

        const podsMap = {}
        for(const c in clusters) {
          const cluster = clusters[c]
          podsMap[cluster.name] = {}
          const clusterNamespaces = namespaces.filter(ns => ns.cluster.name === cluster.name)
          for(const n in clusterNamespaces) {
            const namespace = clusterNamespaces[n]
            podsMap[cluster.name][namespace.name] = []

            const podNames = pods.filter(pod => pod.namespace.cluster.name === cluster.name)
                          .filter(pod => pod.namespace.name === namespace.name)
                          .map(pod => pod.name)
            if(podNames.length > 0) {
              const nsPods = await k8sFunctions.getNamespacePods(namespace.name, podNames, k8sClients[c])
              nsPods.forEach(pod => pod && podsMap[cluster.name][namespace.name].push(pod))
            }
            const output = generatePodStatusOutput(podsMap)
            actionContext.onOutput(output, "Health")
          }
        }
      }
    }
  ]
}
