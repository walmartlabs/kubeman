/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import { PodDetails } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "VirtualService Reachability From IngressGateway",
      order: 21,
      loadingMessage: "Loading VirtualServices...",
      autoRefreshDelay: 60,

      async choose(actionContext) {
        await ChoiceManager.prepareCachedChoices(actionContext, IstioFunctions.getVirtualServices, 
                                                    "VirtualServices", 1, 3, true, "name")
      },

      async act(actionContext) {
        this.clear && this.clear(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)
        const selections: ItemSelection[] = await ChoiceManager.getSelections(actionContext)

        for(const selection of selections) {
          const virtualService = selection.item
          const namespace = virtualService.namespace
          const cluster = actionContext.getClusters()
                              .filter(c => c.name === selection.cluster)[0]
                              
          this.onStreamOutput && this.onStreamOutput([[">VirtualService: " + virtualService.name + ", Cluster: " + cluster.name]])
  
          if(!cluster.hasIstio) {
            this.onStreamOutput && this.onStreamOutput([["Istio not installed"]])
            continue
          }
          if(!cluster.canPodExec) {
            this.onStreamOutput && this.onStreamOutput([["Lacking pod command execution privileges"]])
            continue
          }

          const protocol = virtualService.http ? virtualService.http :
                            virtualService.tls ? virtualService.tls : virtualService.tcp
          const destinations = 
            _.flatten(_.flatten(protocol.map(p => p.route))
                      .map(route => route.destination ? route.destination.host : undefined))
                .filter(dest => dest)

          if(!destinations || destinations.length === 0) {
            this.onStreamOutput && this.onStreamOutput([["VirtualService has no destination"]])
            continue
          }
          for(const destination of destinations) {
            const service = await K8sFunctions.getServiceDetails(destination, namespace, cluster.k8sClient)
            if(service) {
              this.onStreamOutput && this.onStreamOutput([["VirtualService is backed by service: " + service.name]])
              await IstioPluginHelper.checkServiceReachabilityFromIngress(service, namespace, cluster.k8sClient, this.onStreamOutput)
            } else {
              this.onStreamOutput && this.onStreamOutput([["Backing service not found for the VirtualService"]])
              this.onStreamOutput && this.onStreamOutput([["Pinging destination host: " + destination]])
              const ingressPods = await IstioFunctions.getIngressGatewayPods(cluster.k8sClient, true)
              if(!ingressPods || ingressPods.length === 0) {
                this.onStreamOutput && this.onStreamOutput([["IngressGateway not found"]])
                continue
              }
              const sourceIngressPod = ingressPods[0]
              const result = await K8sFunctions.podExec("istio-system", sourceIngressPod.name, "istio-proxy",
                                                      cluster.k8sClient, ["ping", "-c 2", destination])
          
              const pingSuccess = result.includes("2 received")
              this.onStreamOutput && this.onStreamOutput([[
                "Destination " + destination + (pingSuccess ? " is Reachable" : ": is Unreachable") + " from ingress gateway"
              ]])
            }
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([["VirtualService Reachability From IngressGateway"]], ActionOutputStyle.LogWithHealth)
      }
    }
  ]
}

export default plugin
