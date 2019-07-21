/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, } from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions'
import {executeCommand} from './podExecCommand'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import ChoiceManager from '../actions/choiceManager'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "Execute Command on Ingress Pods",
      order: 6,
      autoRefreshDelay: 15,
      loadingMessage: "Loading IngressGateway Pods...",

      choose: ChoiceManager.chooseIngressGatewayPods.bind(ChoiceManager, 1, 5),

      ingressPods: [],
      
      async act(actionContext) {
        this.showOutputLoading && this.showOutputLoading(true)
        const selections = await ChoiceManager.getPodSelections(actionContext, false)
        this.ingressPods = selections.map(s => {
          return {
            container: "istio-proxy",
            pod: s.podName,
            namespace: "istio-system",
            cluster: s.cluster,
            k8sClient: s.k8sClient
          }
        })
        this.clear && this.clear(actionContext)
        this.setScrollMode && this.setScrollMode(true)
        this.showOutputLoading && this.showOutputLoading(false)
      },
      
      async react(actionContext) {
        this.showOutputLoading && this.showOutputLoading(true)
        await executeCommand(this.ingressPods, actionContext, this.clear, this.onStreamOutput)
        this.showOutputLoading && this.showOutputLoading(false)
      },

      refresh(actionContext) {
        this.react && this.react(actionContext)
      },

      clear(actionContext) {
        this.onOutput && this.onOutput([[
          "Send Command To " + this.ingressPods.length + " IngressGateway Pods across " + actionContext.getClusters().length + " Clusters"
        ]], ActionOutputStyle.Mono)
      },
    }
  ]
}

export default plugin