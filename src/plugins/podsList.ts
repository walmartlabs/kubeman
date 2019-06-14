/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextOrder, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import K8sFunctions from '../k8s/k8sFunctions'
import { Namespace } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",
  order: ActionContextOrder.Pod,
  
  actions: [
    {
      name: "List Namespace Pods",
      order: 1,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, false, 1, 10),
      
      async act(actionContext) {
        const namespaces = await ChoiceManager.getSelections(actionContext).map(s => s.item)
        this.directAct && this.directAct(namespaces)
      },

      async directAct(namespaces) {
        this.onOutput && this.onOutput([["Namespace Pods"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const namespace of namespaces) {
          const output: ActionOutput = []
          const cluster = namespace.cluster
          output.push([">Namespace " + namespace.name + ", Cluster: " + cluster.name])
      
          const pods = await K8sFunctions.getAllPodsForNamespace(namespace.name, cluster.k8sClient)
          pods.length === 0 && output.push(["No pods found"])
          pods.forEach(pod => {
            output.push([">>"+pod.name])
            output.push([pod.yaml])
          })
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
