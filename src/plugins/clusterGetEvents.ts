import k8sFunctions from '../../src/k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../../src/actions/actionSpec'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      name: "Get Events",
      order: 1,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()
        const output: ActionOutput = []
        output.push([
          ["Event", "LastTimestamp", "(Count)"],
          "Details",
        ])
        for(const i in clusters) {
          const cluster = clusters[i].name
          output.push(["Cluster: " + cluster, "---", "---"])
          const events = await k8sFunctions.getClusterEvents(cluster, k8sClients[i])
          events.forEach(event => output.push([
            [event.reason, event.lastTimestamp, event.count ? "(" + event.count + ")" : ""],
            event.type ? [
              "type: " + event.type,
              "source: " + event.source,
              "message: " + event.message,
            ] : [],
          ]))
        }
        actionContext.onOutput && actionContext.onOutput(output, ActionOutputStyle.Table)
      },
    },
  ]
}

export default plugin
