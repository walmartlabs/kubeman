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

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Envoy Proxy Recipes",
  actions: [
    {
      name: "Envoy Proxy Connections Report",
      order: 15,
      loadingMessage: "Loading Envoy Proxies...",

      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 10),

      async act(actionContext) {
        this.showOutputLoading && this.showOutputLoading(true)
        const envoys = ChoiceManager.getSelectedEnvoyProxies(actionContext)
        this.onOutput && this.onOutput([["Envoy Proxy Connections Report"]], ActionOutputStyle.Mono)

        for(const envoy of envoys) {
          const cluster = actionContext.getClusters().filter(c => c.name === envoy.cluster)[0]
          const k8sClient = cluster.k8sClient
          if(!cluster.canPodExec) {
            this.onStreamOutput  && this.onStreamOutput([["^^", "Envoy Proxy: " + envoy.title + " @ Cluster: " + envoy.cluster]])
            this.onStreamOutput && this.onStreamOutput([["Lacking pod command execution privileges"]])
            continue
          }
          const output: ActionOutput = []
          output.push(["^^", "Envoy Proxy: " + envoy.title + " @ Cluster: " + envoy.cluster])
          const result = await K8sFunctions.getPodTCPConnectionsInfo(envoy.namespace, envoy.pod, "istio-proxy", k8sClient)
          output.push(result ? [result] : ["No Results"])
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear(actionContext) {
        this.onOutput && this.onOutput([["Envoy Proxy Connections Report"]], ActionOutputStyle.Mono)
      }
    },
  ]
}

export default plugin
