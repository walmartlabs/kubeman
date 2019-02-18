import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionContextOrder,
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  title: "Events",
  order: ActionContextOrder.Events,
  actions: [
    {
      name: "Cluster Events",
      order: 1,
      autoRefreshDelay: 15,
      
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
      react(actionContext) {
        switch(actionContext.inputText) {
          case "clear": 
            this.onOutput && this.onOutput([[["Event", "LastTimestamp", "(Count)"], "Details"]], ActionOutputStyle.TableWithHealth)
            break
          case "help":
            this.showInfo && this.showInfo('Command Help', [
              "/clear: clears output",
              "/help: shows help"
            ])
            break
          default:
            if(actionContext.inputText && actionContext.inputText.length > 0) {
              this.onOutput && this.onOutput([["Unknown Command"]], ActionOutputStyle.Text)
            }
            break
        }
        actionContext.inputText = undefined
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
  ]
}

export default plugin
