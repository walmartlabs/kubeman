import k8sFunctions from '../k8s/k8sFunctions'
import ChoiceManager from '../actions/choiceManager'
import {ActionGroupSpec, ActionContextOrder, ActionContextType, ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Events",
  order: ActionContextOrder.Events,
  actions: [
    {
      name: "Pod Events",
      order: 3,
      autoRefreshDelay: 15,
      loadingMessage: "Loading Pods...",

      choose: ChoiceManager.choosePod.bind(ChoiceManager, 1, 10, false, false),

      async act(actionContext) {
        const selections = await ChoiceManager.getPodSelections(actionContext, false)
        this.directAct && this.directAct(selections)
      },

      async directAct(selections) {
        this.clear && this.clear(this.actionContext)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const i in selections) {
          const selection = selections[i]
          const pod = selection.podName
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
                event.type ? {
                  type: event.type,
                  source: event.source,
                  message: event.message,
                 } : {},
              ])
            }
          })
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([[["Event", "LastTimestamp", "(Count)"], "Details"]], ActionOutputStyle.TableWithHealth)
      }
    }
  ]
}

export default plugin