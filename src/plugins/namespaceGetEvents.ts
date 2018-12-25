import k8sFunctions from '../../src/k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../../src/actions/actionSpec'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  actions: [
    {
      name: "Get Events",
      order: 1,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()
        const namespaces = actionContext.getNamespaces()
        const output: ActionOutput = []
        output.push([
          ["Event", "LastTimestamp", "(Count)"],
          "Details",
        ])
        for(const i in clusters) {
          const cluster = clusters[i]
          output.push([">Cluster: " + cluster.name, ""])

          for(const j in namespaces) {
            const namespace = namespaces[j]
            if(namespace.cluster.name === cluster.name) {
              output.push([">>Namespace: "+namespace.name, ""])
              const events = await k8sFunctions.getNamespaceEvents(namespace.name, k8sClients[i])
              events.forEach(event => {
                if(event.reason === "No Events") {
                  output.push([event.reason])
                } else {
                  output.push([
                    [event.reason, event.lastTimestamp, event.count ? "(" + event.count + ")" : ""],
                    event.type ? [
                      "type: " + event.type,
                      "source: " + event.source,
                      "message: " + event.message,
                    ] : [],
                  ])
                }
              })
            }
          }
        }
        actionContext.onOutput && actionContext.onOutput(output, ActionOutputStyle.Table)
      },
    },
  ]
}

export default plugin
