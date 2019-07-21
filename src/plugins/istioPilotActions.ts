/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions';
import ChoiceManager from '../actions/choiceManager';
import { ServiceDetails } from '../k8s/k8sObjectTypes';
import IstioPluginHelper from '../k8s/istioPluginHelper';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Pilot Recipes",
  order: ActionContextOrder.Istio+2,
  actions: [
    {
      name: "View Pilot Metrics",
      order: 40,
      autoRefreshDelay: 15,
      loadingMessage: "Loading Pilot Pods...",
            
      choose: ChoiceManager.choosePilotPods.bind(ChoiceManager, 1, 3),
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Pilot Metrics"]], ActionOutputStyle.Mono)
        this.showOutputLoading && this.showOutputLoading(true)

        const selections = await ChoiceManager.getPodSelections(actionContext, false)
        for(const selection of selections) {
          const output: ActionOutput = []
          output.push([">Pilot Pod: " + selection.podName + " @ Cluster: " + selection.cluster])
          if(!selection.k8sClient.canPodExec) {
            output.push(["Lacking pod command execution privileges"])
          } else {
            const result = await IstioFunctions.getPilotMetrics(selection.k8sClient, selection.podName)
            result && result.split("\n").map(line => output.push([line]))
            !result && output.push(["N/A"])
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
    },
    {
      name: "View Service Endpoints Known to Pilot",
      order: 41,
      loadingMessage: "Loading Services...",
      
      async choose(actionContext) {
        await ChoiceManager.prepareCachedChoices(actionContext, IstioPluginHelper.getServicesFromIstioEnabledClusters, 
                                                  "Services using Istio", 1, 10, true, "name")
      },
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Service Endpoints Known to Pilot"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        const selections = await ChoiceManager.getSelections(actionContext)
        const output: ActionOutput = []
        for(const selection of selections) {
          const cluster = actionContext.getClusters().filter(c => c.name === selection.cluster)[0]
          if(!cluster.canPodExec) {
            output.push(["Lacking pod command execution privileges"])
          } else if(!cluster.hasIstio) {
            output.push(["Istio not installed"])
          } else {
            const service = selection.item as ServiceDetails
            const namespace = selection.namespace
            const endpoints = await IstioFunctions.getPilotEndpoints(cluster.k8sClient, service.name, namespace)
            output.push([">Service: " + service.name + ", Namespace: " + namespace + ", Cluster: " + cluster.name])
            endpoints.length === 0 && output.push(["No Endpoints Found"])
            endpoints.forEach(ep => output.push([">>"+ep.clusterName], [ep]))
          }
        }
        this.onStreamOutput && this.onStreamOutput(output)
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    }
  ]
}

export default plugin
