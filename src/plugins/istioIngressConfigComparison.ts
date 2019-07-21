/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import EnvoyFunctions, {EnvoyConfigType} from '../k8s/envoyFunctions'
import {compareTwoEnvoys} from './envoyConfigComparison'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "Compare Ingress Envoy Configs",
      order: 31,
      loadingMessage: "Loading IngressGateway Pods...",

      async choose(actionContext) {
        await ChoiceManager.chooseServicePods("istio-ingressgateway", "istio-system", 
                      2, 2, false, true, actionContext)
      },

      async act(actionContext) {
        const selections = await ChoiceManager.getPodSelections(actionContext, false)
        this.onOutput && this.onOutput([["IngressGateway Sidecar Config Comparison", ""]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const pod1 = selections[0]
        const cluster1 = actionContext.getClusters().filter(c => c.name === pod1.cluster)[0]
        const pod2 = selections[1]
        const cluster2 = actionContext.getClusters().filter(c => c.name === pod2.cluster)[0]
        if(!cluster1.canPodExec || !cluster1.canPodExec) {
          this.onStreamOutput && this.onStreamOutput([["Lacking pod command execution privileges"]])
        } else {
          await compareTwoEnvoys(pod1.namespace, pod1.podName, "istio-proxy", cluster1.k8sClient,
                        pod2.namespace, pod2.podName, "istio-proxy", cluster2.k8sClient, this.onStreamOutput)
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
