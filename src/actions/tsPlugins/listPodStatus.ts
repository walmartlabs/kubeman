import jpExtract from '../../util/jpExtract'
import { ActionOutput } from "../actionSpec";
import ActionContext from '../actionContext'

module.exports = {
  order: 4,
  context: "Pod",
  actions: [
    {
      name: "Get Pod Status",
      act(actionContext: ActionContext) {
        const clusters = actionContext.getClusters()
        const namespaces = actionContext.getNamespaces()
        const pods = actionContext.getPods()
        const output : ActionOutput = []
        output.push(["Pod", "Container", "Status"])

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
