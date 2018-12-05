import jpExtract from '../../util/jpExtract'
import {methodGetClusters, methodGetNamespaces, methodGetPods, outputMethod} from '../actionSpec'
import { ActionOutput } from "../actionSpec";

module.exports = {
  order: 4,
  context: "Pod",
  actions: [
    {
      name: "Get Pod Status",
      act(getClusters: methodGetClusters, getNamespaces: methodGetNamespaces, 
          getPods: methodGetPods, onOutput: outputMethod) {
        const output : ActionOutput = []
        output.push(["Pod", "Container", "Status"])
        const clusters = getClusters()
        const namespaces = getNamespaces()
        const pods = getPods()

        clusters.forEach(cluster => {
          output.push([cluster.name, "---", "---"])
          namespaces.forEach(namespace => {
            if(namespace.cluster.name === cluster.name) {
              output.push([namespace.name, "---", "---"])
              pods.forEach(pod => {
                if(pod.namespace.cluster.name === cluster.name && 
                  pod.namespace.name === namespace.name) {
                  const containerStatuses = jpExtract.extractMulti(pod, "$.status.containerStatuses[*]",
                                                "name", "state")
                  containerStatuses.forEach(result => {
                    output.push([
                      "Pod: " + pod.name,
                      "Container: " + result.name,
                      "Status: " + JSON.stringify(result.state)])
                  })
                }
              })
            }
          })
        })
      }
    }
  ]
}
