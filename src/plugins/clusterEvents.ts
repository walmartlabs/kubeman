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
        this.onOutput && this.onOutput([[["Event", "LastTimestamp", "(Count)"], "Details"]], ActionOutputStyle.TableWithHealth)
        this.showOutputLoading && this.showOutputLoading(true)
        for(const i in clusters) {
          const output: ActionOutput = []
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
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
  ]
}

export default plugin
