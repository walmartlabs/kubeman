import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionSpec, } from '../actions/actionSpec'
import K8sPluginHelper from '../k8s/k8sPluginHelper'
import ActionContext from '../actions/actionContext';


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",

  logStream: undefined,

  async getPodLogs(actionContext: ActionContext, action: ActionSpec, tail: boolean) {
    action.setScrollMode && action.setScrollMode(true)
    const selections = await K8sPluginHelper.getPodSelections(actionContext)
    if(selections.length < 1) {
      action.onOutput && action.onOutput([["No pod selected"]], ActionOutputStyle.Text)
      return
    }
    const selection = selections[0]
    action.onOutput && action.onOutput([["Logs for " + selection.title]], ActionOutputStyle.Log)
    action.showOutputLoading && action.showOutputLoading(true)
  
    const logStream = await k8sFunctions.getPodLog(selection.namespace, selection.pod, 
                              selection.container, selection.k8sClient, tail)
    logStream.onLog(lines => {
      lines = lines.split("\n")
              .filter(line => line.length > 0)
              .map(line => [line])
      action.onStreamOutput && action.onStreamOutput(lines)
    })
    if(tail) {
      this.logStream = logStream
    } else {
      setTimeout(() => {
        logStream.stop()
      }, 10000)
    }
    action.showOutputLoading && action.showOutputLoading(false)
  },

  actions: [
    {
      name: "Check Pod Logs",
      order: 4,
      choose: K8sPluginHelper.choosePod.bind(K8sPluginHelper, 1, 1, true, false),
      async act(actionContext) {
        await plugin.getPodLogs(actionContext, this, false)
      }
    },
    {
      name: "Tail Pod Logs",
      order: 5,
      choose: K8sPluginHelper.choosePod.bind(K8sPluginHelper, 1, 1, true, false),
      async act(actionContext) {
        await plugin.getPodLogs(actionContext, this, true)
      },
      stop(actionContext) {
        if(plugin.logStream) {
          plugin.logStream.stop()
          plugin.logStream = undefined
        }
      }
    }
  ]
}

export default plugin