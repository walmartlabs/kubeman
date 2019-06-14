/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions';
import IstioFunctions from '../k8s/istioFunctions';
import yaml from 'yaml'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Envoy Proxy Recipes",
  actions: [
    {
      name: "List Envoy Proxies",
      order: 1,
      async act(actionContext) {
        this.onOutput && this.onOutput([["", "Envoy Proxies List"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          const output: ActionOutput = []
          output.push([">Envoy Proxies @ Cluster: " + cluster.name, ""])
      
          if(cluster.hasIstio) {
            const sidecars = await IstioFunctions.getAllEnvoyProxies(cluster.k8sClient)
            sidecars.length === 0 && output.push(["", "No envoy proxies found"])
            sidecars.forEach(sc => {
              output.push([">>" + sc.pod+"."+sc.namespace, ""])
              output.push(["IP", sc.ip])
            })
          } else {
            output.push(["", "Istio not installed"])
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
  ]
}

export default plugin
