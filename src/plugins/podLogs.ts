/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionSpec, } from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'
import ActionContext from '../actions/actionContext'
import StreamLogger from '../logger/streamLogger'
import OutputManager from '../output/outputManager'


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",

  selections: undefined,

  getSelectionAsText() {
    return this.selections ? this.selections.map(s => 
        "["+s.title+"."+s.namespace+"."+s.cluster+"]")
        .join(", ") : ""
  },

  async getPodLogs(actionContext: ActionContext, action: ActionSpec, tail: boolean, ...filters) {
    this.selections = await ChoiceManager.getPodSelections(actionContext, false, true)
    action.clear && action.clear(actionContext)
    action.setScrollMode && action.setScrollMode(false)
    const podRowLimit = Math.ceil((action.outputRowLimit || 200)/this.selections.length)

    StreamLogger.init(action.outputRowLimit, action.onStreamOutput, ...filters)
    filters.length > 0 && OutputManager.filter(filters.join(" "))
    
    for(const selection of this.selections) {
      action.showOutputLoading && action.showOutputLoading(true)
      const logStream = await k8sFunctions.getPodLog(selection.namespace, selection.podName, 
                                selection.containerName, selection.k8sClient, tail, podRowLimit)
      StreamLogger.captureLogStream(selection.title, logStream)
      if(tail) {
        action.showOutputLoading && action.showOutputLoading(false)
      } else {
        setTimeout(() => {
          action.showOutputLoading && action.showOutputLoading(false)
          StreamLogger.stop()
        }, 5000)
      }
    }
  },

  actions: [
    {
      name: "Check Pod/Container Logs",
      order: 10,
      autoRefreshDelay: 30,
      loadingMessage: "Loading Containers@Pods...",
      outputRowLimit: 1000,

      choose: ChoiceManager.choosePods.bind(ChoiceManager, 1, 5, true, false),
      async act(actionContext) {
        await plugin.getPodLogs(actionContext, this, false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([["Check Logs for: " + plugin.getSelectionAsText()]], ActionOutputStyle.Log)
      }
    },
    {
      name: "Tail Pod/Container Logs",
      order: 11,
      loadingMessage: "Loading Containers@Pods...",
      outputRowLimit: 300,

      choose: ChoiceManager.choosePods.bind(ChoiceManager, 1, 5, true, false),
      async act(actionContext) {
        await plugin.getPodLogs(actionContext, this, true)
      },
      stop(actionContext) {
        StreamLogger.stop()
      },
      clear() {
        this.onOutput && this.onOutput([["Tail Logs for: " + plugin.getSelectionAsText()]], ActionOutputStyle.Log)
      }
    },
    {
      name: "Tail Filtered Pod/Container Logs",
      order: 12,
      loadingMessage: "Loading Containers@Pods...",
      outputRowLimit: 300,
      filter: undefined,

      choose: ChoiceManager.choosePods.bind(ChoiceManager, 1, 5, true, false),

      async act(actionContext) {
        this.filter = undefined
        this.clear && this.clear(actionContext)
      },
      
      async react(actionContext) {
        this.filter = actionContext.inputText
        await plugin.getPodLogs(actionContext, this, true, this.filter)
      },

      stop(actionContext) {
        StreamLogger.stop()
      },

      clear() {
        let title = "Tail Filtered Logs for: " + plugin.getSelectionAsText()
        if(this.filter) {
          title += ", Applied Filter: [ " + this.filter + " ]"
        }
        this.onOutput && this.onOutput([[title, ""]], ActionOutputStyle.Log)
      }
    }
  ]
}

export default plugin