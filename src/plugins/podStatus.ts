/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import K8sFunctions from '../k8s/k8sFunctions'
import ChoiceManager from '../actions/choiceManager'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'
import { PodDetails, Namespace } from '../k8s/k8sObjectTypes';
import JsonUtil from '../util/jsonUtil';

type ClusterNamespacePodsMap = {[cluster: string]: {[namespace: string]: PodDetails[]}}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",
  actions: [
    {
      name: "View Pod(s) Status",
      order: 5,
      autoRefreshDelay: 15,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, false, 1, 10),

      async act(actionContext) {
        this.clear && this.clear(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)


        const clusters = actionContext.getClusters()
        const selections = await ChoiceManager.getSelections(actionContext)
        for(const cluster of clusters) {
          this.onStreamOutput && this.onStreamOutput([[">Cluster: "+cluster.name, ""]])
      
          let clusterNamespaces = selections.filter(s => s.cluster === cluster.name).map(s => s.item) as Namespace[]
          for(const namespace of clusterNamespaces) {
            const output: ActionOutput = []
            output.push([">>Namespace: "+namespace.name, ""])
            const pods = await K8sFunctions.getAllPodsForNamespace(namespace.name, cluster.k8sClient)
            pods.length === 0 && output.push(["No pods found"])
            pods.forEach(pod => {
              output.push([[pod.name, "Created: "+pod.creationTimestamp],
                ["Conditions: ", JsonUtil.flattenObjectsWithKeyValueFields(pod.conditions, "type", "status"),
                "","ContainerStatuses: ", JsonUtil.flattenObject(pod.containerStatuses)]])
            })
            this.onStreamOutput && this.onStreamOutput(output)
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([["Pod", "Status"]], ActionOutputStyle.Table)
      }
    },
    {
      name: "View Pod(s) Resource Configurations",
      order: 6,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, false, 1, 10),

      async act(actionContext) {
        this.clear && this.clear(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)


        const clusters = actionContext.getClusters()
        const selections = await ChoiceManager.getSelections(actionContext)
        for(const cluster of clusters) {
          this.onStreamOutput && this.onStreamOutput([[">Cluster: "+cluster.name, ""]])
      
          let clusterNamespaces = selections.filter(s => s.cluster === cluster.name).map(s => s.item) as Namespace[]
          for(const namespace of clusterNamespaces) {
            const output: ActionOutput = []
            output.push([">>Namespace: "+namespace.name, ""])
            const pods = await K8sFunctions.getAllPodsForNamespace(namespace.name, cluster.k8sClient)
            pods.length === 0 && output.push(["No pods found", ""])
            pods.forEach(pod => {
              output.push([">>>Pod: "+pod.name+"."+pod.namespace, ""])
              pod.containers.forEach(c => {
                output.push([c.name, c.resources])
              })
            })
            this.onStreamOutput && this.onStreamOutput(output)
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      clear() {
        this.onOutput && this.onOutput([["Pod", "Config"]], ActionOutputStyle.Table)
      }
    }
  ]
}

export default plugin
