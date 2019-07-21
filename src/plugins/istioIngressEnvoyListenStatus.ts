/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import ChoiceManager from '../actions/choiceManager'
import { PodDetails } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "Check Ingress Envoy Listen Status",
      order: 35,
      loadingMessage: "Loading IngressGateway Pods...",

      choose: ChoiceManager.chooseIngressGatewayPods.bind(ChoiceManager, 1, 5),

      async act(actionContext) {
        this.onOutput && this.onOutput([["IngressGateway Envoy Listen Status", ""]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        const selections = await ChoiceManager.getPodSelections(actionContext, false)
        for(const selection of selections) {
          const cluster = actionContext.getClusters().filter(c => c.name === selection.cluster)[0]
          if(!cluster.canPodExec) {
            this.onStreamOutput && this.onStreamOutput([["Lacking pod command execution privileges"]])
            continue
          }
          const output: ActionOutput = []
          output.push([">Ingress Pod: " + selection.podName + " on Cluster: " + cluster.name])
          const listenerConfigs = await IstioFunctions.getIngressGatewayEnvoyListeners(cluster.k8sClient, selection.podName)
          for(const l of listenerConfigs) {
            output.push([">>>Listener: " + l.title])
            const port = l.listener.address.socket_address.port_value
            const result = (await K8sFunctions.podExec("istio-system", selection.podName, "istio-proxy", cluster.k8sClient,
                            ["sh", "-c", "'netstat -an | grep LISTEN | grep " + port + "'"])).toString()
            const isListening = result.includes("LISTEN") && result.includes(port)
            output.push(["Pod is " + (isListening ? "" : "NOT ") + " listening on port " + port])
          }
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
