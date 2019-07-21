/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions';
import ChoiceManager from '../actions/choiceManager';
import StreamLogger from '../logger/streamLogger'
import ActionContext from '../actions/actionContext';


async function showLogs(action: ActionSpec, actionContext: ActionContext, tail: boolean, ...filters) {
  action.selections = ChoiceManager.getSelectedEnvoyProxies(actionContext)
  action.clear && action.clear(actionContext)
  action.setScrollMode && action.setScrollMode(true)
  action.showOutputLoading && action.showOutputLoading(true)
  StreamLogger.init(action.outputRowLimit, action.onStreamOutput)
  const podRowLimit = Math.ceil((action.outputRowLimit || 200)/action.selections.length)

  for(const selection of action.selections) {
    const cluster = actionContext.getClusters().filter(c => c.name === selection.cluster)[0]
    const logStream = await K8sFunctions.getPodLog(selection.namespace, selection.pod, 
                              "istio-proxy", cluster.k8sClient, tail, podRowLimit)
    StreamLogger.captureLogStream(selection.title, logStream)
  }

  action.showOutputLoading && action.showOutputLoading(false)
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Envoy Proxy Recipes",
  actions: [
    {
      name: "Check Envoy Logs",
      order: 10,
      selections: undefined,
      logStreams: [],
      loadingMessage: "Loading Envoy Proxies...",
      outputRowLimit: 1000,

      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 3),

      async act(actionContext) {
        showLogs(this, actionContext, false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear(actionContext) {
        const selectionsText = this.selections ? this.selections.map(s => 
                                  "["+s.title+"@"+s.cluster+"]")
                                  .join(", ") : ""
        this.onOutput && this.onOutput([["Sidecars Logs for: " + selectionsText]], ActionOutputStyle.Log)
      },
      stop(actionContext) {
        if(this.logStreams.length > 0) {
          this.logStreams.forEach(stream => stream.stop())
          this.logStreams = []
        }
      }
    },
    {
      name: "Tail Envoy Logs",
      order: 11,
      selections: undefined,
      logStreams: [],
      loadingMessage: "Loading Envoy Proxies...",
      outputRowLimit: 300,

      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 3),

      async act(actionContext) {
        showLogs(this, actionContext, true)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear(actionContext) {
        const selectionsText = this.selections ? this.selections.map(s => 
                                  "["+s.title+"@"+s.cluster+"]")
                                  .join(", ") : ""
        this.onOutput && this.onOutput([["Tail Sidecars Logs for: " + selectionsText]], ActionOutputStyle.Log)
      },
      stop(actionContext) {
        if(this.logStreams.length > 0) {
          this.logStreams.forEach(stream => stream.stop())
          this.logStreams = []
        }
      }
    }
  ]
}

export default plugin
