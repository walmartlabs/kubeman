/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import K8sPluginHelper from '../k8s/k8sPluginHelper'
import IstioFunctions from '../k8s/istioFunctions'
import ChoiceManager from '../actions/choiceManager'
import { ContainerInfo, Cluster } from '../k8s/k8sObjectTypes'
import StreamLogger from '../logger/streamLogger'
import OutputManager from '../output/outputManager';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  order: ActionContextOrder.Istio+1,

  actions: [
    {
      name: "Check Ingress Logs",
      order: 3,
      outputRowLimit: 1000,
      loadingMessage: "Loading Clusters...",

      choose: ChoiceManager.chooseClusters.bind(ChoiceManager, 1, 1),
      
      async act(actionContext) {
        this.clear && this.clear(actionContext)
        const cluster = ChoiceManager.getSelectedClusters(actionContext)[0]
        const ingressPods = (await IstioFunctions.getIngressGatewayPods(cluster.k8sClient, true))
                            .map(p => p.podDetails)
        K8sPluginHelper.getPodLogs(ingressPods, "istio-proxy", cluster.k8sClient, false,
            this.outputRowLimit, this.outputRowLimit, this.onStreamOutput, this.showOutputLoading, this.setScrollMode)
      },

      stop(actionContext) {
        StreamLogger.stop()
      },

      clear(actionContext) {
        this.onOutput && this.onOutput([["Istio IngressGateway Logs (All Pods)", ""]], ActionOutputStyle.Log)
      },
    },
    {
      name: "Tail Ingress Logs",
      order: 4,
      outputRowLimit: 300,
      loadingMessage: "Loading Clusters...",

      choose: ChoiceManager.chooseClusters.bind(ChoiceManager, 1, 1),
      
      async act(actionContext) {
        this.clear && this.clear(actionContext)
        const cluster = ChoiceManager.getSelectedClusters(actionContext)[0]
        const ingressPods = (await IstioFunctions.getIngressGatewayPods(cluster.k8sClient, true))
                            .map(p => p.podDetails)
        K8sPluginHelper.getPodLogs(ingressPods, "istio-proxy", cluster.k8sClient, true,
            this.outputRowLimit, 200, this.onStreamOutput, this.showOutputLoading, this.setScrollMode)
      },

      stop(actionContext) {
        StreamLogger.stop()
      },

      clear(actionContext) {
        this.onOutput && this.onOutput([["Tail Istio IngressGateway Logs (All Pods)", ""]], ActionOutputStyle.Log)
      },
    },
    {
      name: "Tail Filtered Ingress Logs",
      order: 5,
      outputRowLimit: 300,
      selectedCluster: undefined,
      filter: undefined,
      loadingMessage: "Loading Clusters...",

      choose: ChoiceManager.chooseClusters.bind(ChoiceManager, 1, 1),
      
      async act(actionContext) {
        this.filter = undefined
        this.clear && this.clear(actionContext)
        this.selectedCluster = ChoiceManager.getSelectedClusters(actionContext)[0]
      },
      
      async react(actionContext) {
        this.filter = actionContext.inputText
        this.clear && this.clear(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)
        const ingressPods = (await IstioFunctions.getIngressGatewayPods(this.selectedCluster.k8sClient, true))
                            .map(p => p.podDetails)
        K8sPluginHelper.getPodLogs(ingressPods, "istio-proxy", this.selectedCluster.k8sClient, true,
              this.outputRowLimit, 200, this.onStreamOutput, this.showOutputLoading, this.setScrollMode, this.filter)
        this.showOutputLoading && this.showOutputLoading(false)
      },

      stop(actionContext) {
        StreamLogger.stop()
      },

      clear() {
        let title = "Tail Filtered Istio IngressGateway Logs (All Pods)"
        if(this.filter) {
          title += ", Applied Filter: [ " + this.filter + " ]"
        }
        this.onOutput && this.onOutput([[title, ""]], ActionOutputStyle.Log)
      },
    }
  ]
}

export default plugin
