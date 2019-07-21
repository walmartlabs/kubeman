/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextOrder, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import K8sFunctions from '../k8s/k8sFunctions'
import { Namespace } from '../k8s/k8sObjectTypes'
import KubectlClient from '../k8s/kubectlClient'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",
  order: ActionContextOrder.Pod,
  
  actions: [
    {
      name: "List Namespace Pods",
      order: 1,
      loadingMessage: "Loading Namespaces...",
      namespaces: [],

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, false, 1, 5),
      
      async act(actionContext) {
        this.namespaces = await ChoiceManager.getSelections(actionContext).map(s => s.item) as Namespace[]
        this.directAct && this.directAct(this.namespaces)
      },

      async directAct(namespaces: Namespace[]) {
        this.onOutput && this.onOutput([["Namespace Pods"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const namespace of namespaces) {
          const output: ActionOutput = []
          const cluster = namespace.cluster
      
          if(cluster.hasKubectl) {
            const items = await KubectlClient.getPodsStatus(cluster, namespace.name)
            output.push([">Namespace " + namespace.name + ", Cluster: " + cluster.name + " ("+(items.length-1)+" pods)"])
            items.forEach(item => output.push(["<<", ...item]))
          } else {
            const pods = await K8sFunctions.getAllPodsForNamespace(namespace.name, cluster.k8sClient)
            output.push([">Namespace " + namespace.name + ", Cluster: " + cluster.name + " ("+pods.length+" pods)"])
            pods.length === 0 && output.push(["No pods found"])
            output.push(["Name", "CeationTimestamp", "StartTime", "podIP"])
            pods.forEach(pod => {
              output.push([pod.name, pod.creationTimestamp, pod.startTime, pod.podIP])
            })
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.directAct && this.directAct(this.namespaces)
      },
      clear() {
        this.onOutput && this.onOutput([["Namespace Pods"]], ActionOutputStyle.Table)
      },
    }
  ]
}

export default plugin
