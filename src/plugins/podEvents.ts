import k8sFunctions from '../k8s/k8sFunctions'
import K8sPluginHelper from '../k8s/k8sPluginHelper'
import {ActionGroupSpec, ActionContextOrder, ActionContextType, ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",
  order: ActionContextOrder[ActionContextType.Namespace]+2,
  actions: [
    {
      name: "View Pod(s) Events",
      order: 1,
      autoRefreshDelay: 15,

      choose: K8sPluginHelper.choosePod.bind(K8sPluginHelper, 1, 10, false, false),

      async act(actionContext) {
        const selections = await K8sPluginHelper.getPodSelections(actionContext, true, false)
        this.onOutput && this.onOutput([[["Event", "LastTimestamp", "(Count)"], "Details"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const i in selections) {
          const selection = selections[i]
          const pod = selection.pod
          const namespace = selection.namespace
          const cluster = selection.cluster
          const output: ActionOutput = []
        
          output.push([">" + pod + ", Cluster: "+cluster + ", Namespace: "+namespace, ""])
          const events = await k8sFunctions.getPodEvents(namespace, pod, selection.k8sClient)
          events.forEach(event => {
            if(event.reason === "No Events") {
              output.push([event.reason])
            }
            else {
              output.push([
                [event.reason, event.lastTimestamp, "(" + event.count + ")"],
                [
                  "type: " + event.type,
                  "source: " + event.source,
                  "message: " + event.message,
                ],
              ])
            }
          })
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    }
  ]
}

export default plugin