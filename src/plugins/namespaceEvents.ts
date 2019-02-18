import K8sFunctions from '../k8s/k8sFunctions'
import K8sPluginHelper from '../k8s/k8sPluginHelper';
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, ActionContextOrder} from '../actions/actionSpec'
import { Namespace } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Events",
  order: ActionContextOrder.Events,
  actions: [
    {
      name: "Namespace Events",
      order: 1,
      autoRefreshDelay: 15,

      choose: K8sPluginHelper.chooseNamespaces.bind(K8sPluginHelper, false, 1, 10),
      
      async act(actionContext) {
        const selections = await K8sPluginHelper.getSelections(actionContext)

        this.onOutput && this.onOutput([[
          ["Event", "LastTimestamp", "(Count)"],
          "Details",
        ]], ActionOutputStyle.TableWithHealth)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        const namespaces = actionContext.getNamespaces()
        for(const i in clusters) {
          const output: ActionOutput = []
          const cluster = clusters[i]
          output.push([">Cluster: " + cluster.name, ""])

          let clusterNamespaces = selections.filter(s => s.cluster === cluster.name).map(s => s.item) as Namespace[]

          for(const namespace of clusterNamespaces) {
            output.push([">>Namespace: "+namespace.name, ""])
            const events = await K8sFunctions.getNamespaceEvents(namespace.name, cluster.k8sClient)
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
      },
    },
  ]
}

export default plugin
