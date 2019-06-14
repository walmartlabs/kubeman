/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, } from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions'
import {executeCommand} from './podExecCommand'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "Execute Command on Ingress Pods",
      order: 5,
      autoRefreshDelay: 15,

      ingressPods: [],
      
      async act(actionContext) {
        this.showOutputLoading && this.showOutputLoading(true)
        this.ingressPods = []
        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["Istio not installed"]])
            continue
          }
          const pods = await IstioFunctions.getIngressGatewayPods(cluster.k8sClient)
          this.ingressPods = this.ingressPods.concat(
            pods.map(p => {
              return {
                container: "istio-proxy",
                pod: p.name,
                namespace: "istio-system",
                cluster: cluster.name,
                k8sClient: cluster.k8sClient
              }
            }))
        }
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
        ]], ActionOutputStyle.Log)
      },
    }
  ]
}

export default plugin