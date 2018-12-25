import k8sFunctions from '../../src/k8s/k8sFunctions'
import K8sPluginHelper from '../../src/util/k8sPluginHelper'
import {ActionGroupSpec, ActionContextType, ActionOutput, ActionOutputStyle, } from '../../src/actions/actionSpec'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Actions",
  actions: [
    {
      name: "View Pod(s) Events",
      order: 1,

      choose: K8sPluginHelper.choosePod.bind(null, 1, 10, false, false),

      async act(actionContext) {
        const selections = await K8sPluginHelper.getPodSelections(actionContext, true, false)
        if(selections.length < 1) {
          actionContext.onOutput && actionContext.onOutput([["No pod selected"]], ActionOutputStyle.Text)
          return
        }
        actionContext.onOutput && actionContext.onOutput([[["Event", "LastTimestamp", "(Count)"], "Details"]], ActionOutputStyle.Table)

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
          actionContext.onStreamOutput && actionContext.onStreamOutput(output)
        }
      }
    }
  ]
}

export default plugin