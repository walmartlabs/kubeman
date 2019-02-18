import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionSpec, } from '../actions/actionSpec'
import K8sPluginHelper from '../k8s/k8sPluginHelper'
import ActionContext from '../actions/actionContext';


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",

  logStreams: [],

  async getPodLogs(actionContext: ActionContext, action: ActionSpec, tail: boolean) {
    action.setScrollMode && action.setScrollMode(true)
    const selections = await K8sPluginHelper.getPodSelections(actionContext)
    if(selections.length < 1) {
      action.onOutput && action.onOutput([["No pod selected"]], ActionOutputStyle.Text)
      return
    }
    action.onOutput && action.onOutput([["Pod","Logs"]], ActionOutputStyle.Log)
    const lineCount = (50/selections.length) < 20 ? 20 : (50/selections.length)
    for(const selection of selections) {
      action.showOutputLoading && action.showOutputLoading(true)
      const logStream = await k8sFunctions.getPodLog(selection.namespace, selection.pod, 
                                selection.container, selection.k8sClient, tail, lineCount)
      logStream.onLog(lines => {
        lines = lines.split("\n")
                .filter(line => line.length > 0)
                .map(line => [selection.title, line])
        action.onStreamOutput && action.onStreamOutput(lines)
      })
      if(tail) {
        this.logStreams.push(logStream)
        action.showOutputLoading && action.showOutputLoading(false)
      } else {
        setTimeout(() => {
          action.showOutputLoading && action.showOutputLoading(false)
          logStream.stop()
        }, 10000)
      }
    }
  
    action.showOutputLoading && action.showOutputLoading(false)
  },

  actions: [
    {
      name: "Check Pod Logs",
      order: 10,
      autoRefreshDelay: 15,
      loadingMessage: "Loading Containers@Pods...",

      choose: K8sPluginHelper.choosePod.bind(K8sPluginHelper, 1, 5, true, false),
      async act(actionContext) {
        await plugin.getPodLogs(actionContext, this, false)
      },
      react(actionContext) {
        if(actionContext.inputText && actionContext.inputText.includes("clear")) {
          this.onOutput && this.onOutput([["Pod","Logs"]], ActionOutputStyle.Log)
        }
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Tail Pod Logs",
      order: 11,
      loadingMessage: "Loading Containers@Pods...",

      choose: K8sPluginHelper.choosePod.bind(K8sPluginHelper, 1, 5, true, false),
      async act(actionContext) {
        await plugin.getPodLogs(actionContext, this, true)
      },
      react(actionContext) {
        if(actionContext.inputText && actionContext.inputText.includes("clear")) {
          this.onOutput && this.onOutput([["Pod","Logs"]], ActionOutputStyle.Log)
        }
      },
      stop(actionContext) {
        if(plugin.logStreams.length > 0) {
          plugin.logStreams.forEach(stream => stream.stop())
          plugin.logStreams = []
        }
      }
    }
  ]
}

export default plugin