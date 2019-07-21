/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import k8sFunctions from '../k8s/k8sFunctions'
import {K8sClient} from '../k8s/k8sClient'
import ChoiceManager from '../actions/choiceManager'
import {ActionGroupSpec, ActionContextType, ActionContextOrder,
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  title: "Namespace Recipes",
  order: ActionContextOrder.Namespace,
  actions: [
    {
      name: "Compare Cluster Namespaces",
      order: 11,
      loadingMessage: "Loading Clusters...",

      choose: ChoiceManager.chooseClusters.bind(ChoiceManager, 1, 3),

      async act(actionContext) {
        const clusters = ChoiceManager.getSelectedClusters(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)
        const nsClusterMap = {}
        for(const cluster of clusters) {
          const namespaces = await k8sFunctions.getClusterNamespaces(cluster.k8sClient)
          namespaces.forEach(ns => {
            if(!nsClusterMap[ns.name]) {
              nsClusterMap[ns.name] = []
            }
            nsClusterMap[ns.name][cluster.name]=true
          })
        }
        const output: ActionOutput = []
        const headers = ["Namespace"]
        clusters.forEach(cluster => {
          headers.push("Cluster: " + cluster.name)
        })
        output.push(headers)

        const namespaces = Object.keys(nsClusterMap).sort()
        namespaces.forEach(ns => {
          const row: any[] = [ns]
          for(const cluster of clusters) {
            row.push(nsClusterMap[ns][cluster.name] ? "Yes" : "No")
          }
          output.push(row)
        })
        this.onOutput && this.onOutput(output, ActionOutputStyle.Compare)
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
  ]
}

export default plugin
