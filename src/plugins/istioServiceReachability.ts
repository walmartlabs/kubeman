/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "Service Reachability From IngressGateway",
      order: 20,
      autoRefreshDelay: 60,
      loadingMessage: "Loading Services...",

      choose: ChoiceManager.chooseService.bind(ChoiceManager, 1, 5),

      async act(actionContext) {
        const selections: ItemSelection[] = await ChoiceManager.getServiceSelections(actionContext)
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No service selected"]], ActionOutputStyle.Text)
          return
        }
        this.clear && this.clear(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const selection of selections) {
          const service = selection.item
          const namespace = service.namespace
          const cluster = actionContext.getClusters()
                              .filter(c => c.name === selection.cluster)[0]
          this.onStreamOutput && this.onStreamOutput([[">Service: " + service.name + ", Cluster: " + cluster.name]])
          if(!cluster.hasIstio) {
            this.onStreamOutput && this.onStreamOutput([["Istio not installed"]])
            continue
          }
          await IstioPluginHelper.checkServiceReachabilityFromIngress(service, namespace, cluster.k8sClient, this.onStreamOutput)
        }

        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([["Service Reachability From IngressGateway"]], ActionOutputStyle.LogWithHealth)
      },
    }
  ]
}

export default plugin
