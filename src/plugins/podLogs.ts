import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionSpec, } from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'
import ActionContext from '../actions/actionContext';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",

  logStreams: [],
  selections: undefined,

  getSelectionAsText() {
    return this.selections ? this.selections.map(s => 
        "["+s.container+"@"+s.pod+"."+s.namespace+"."+s.cluster+"]")
        .join(", ") : ""
  },

  async getPodLogs(actionContext: ActionContext, action: ActionSpec, tail: boolean) {
    this.selections = await ChoiceManager.getPodSelections(actionContext)
    action.clear && action.clear(actionContext)
    action.setScrollMode && action.setScrollMode(true)
    const lineCount = (50/this.selections.length) < 20 ? 20 : (50/this.selections.length)
    for(const selection of this.selections) {
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
        }, 5000)
      }
    }
  },

  actions: [
    {
      name: "Check Container Logs",
      order: 10,
      autoRefreshDelay: 30,
      loadingMessage: "Loading Containers@Pods...",

      choose: ChoiceManager.choosePod.bind(ChoiceManager, 1, 5, true, false),
      async act(actionContext) {
        await plugin.getPodLogs(actionContext, this, false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([["Pod","Logs for: " + plugin.getSelectionAsText()]], ActionOutputStyle.Log)
      }
    },
    {
      name: "Tail Container Logs",
      order: 11,
      loadingMessage: "Loading Containers@Pods...",

      choose: ChoiceManager.choosePod.bind(ChoiceManager, 1, 5, true, false),
      async act(actionContext) {
        await plugin.getPodLogs(actionContext, this, true)
      },
      stop(actionContext) {
        if(plugin.logStreams.length > 0) {
          plugin.logStreams.forEach(stream => stream.stop())
          plugin.logStreams = []
        }
      },
      clear() {
        this.onOutput && this.onOutput([["Pod","Logs for: " + plugin.getSelectionAsText()]], ActionOutputStyle.Log)
      }
    }
  ]
}

export default plugin