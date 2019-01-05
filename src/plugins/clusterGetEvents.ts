import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      name: "Get Events",
      order: 1,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const output: ActionOutput = []
        output.push([
          ["Event", "LastTimestamp", "(Count)"],
          "Details",
        ])
        for(const i in clusters) {
          const cluster = clusters[i]
          output.push([">Cluster: " + cluster.name, "", ""])
          const events = await k8sFunctions.getClusterEvents(cluster.name, cluster.k8sClient)
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
        this.onOutput && this.onOutput(output, ActionOutputStyle.Table)
      },
    },
  ]
}

export default plugin
