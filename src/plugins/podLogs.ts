import k8sFunctions from '../../src/k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, } from '../../src/actions/actionSpec'
import K8sPluginHelper from '../../src/util/k8sPluginHelper'
import ActionContext from '../../src/actions/actionContext';


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Actions",

  logStream: undefined,

  async getPodLogs(actionContext: ActionContext, tail: boolean) {
    const selections = await K8sPluginHelper.getPodSelections(actionContext)
    if(selections.length < 1) {
      actionContext.onOutput && actionContext.onOutput([["No pod selected"]], ActionOutputStyle.Text)
      return
    }
    const selection = selections[0]
    actionContext.onOutput && actionContext.onOutput([["Logs for " + selection.title]], ActionOutputStyle.Log)
  
    const logStream = await k8sFunctions.getPodLog(selection.namespace, selection.pod, 
                              selection.container, selection.k8sClient, tail)
    logStream.onLog(lines => {
      lines = lines.split("\n")
              .filter(line => line.length > 0)
              .map(line => [line])
      actionContext.onStreamOutput && actionContext.onStreamOutput(lines)
    })
    if(tail) {
      this.logStream = logStream
    } else {
      setTimeout(() => {
        logStream.stop()
      }, 10000)
    }
  },

  actions: [
    {
      name: "Check Pod Logs",
      order: 4,
      choose: K8sPluginHelper.choosePod.bind(null, 1, 1, true, false),
      async act(actionContext) {
        await plugin.getPodLogs(actionContext, false)
      }
    },
    {
      name: "Tail Pod Logs",
      order: 5,
      choose: K8sPluginHelper.choosePod.bind(null, 1, 1, true, false),
      async act(actionContext) {
        await plugin.getPodLogs(actionContext, true)
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