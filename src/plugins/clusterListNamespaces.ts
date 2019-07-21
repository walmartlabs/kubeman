/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionContextOrder,
        ActionOutput, ActionOutputStyle } from '../actions/actionSpec'
import ActionContext from '../actions/actionContext'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  title: "Namespace Recipes",
  order: ActionContextOrder.Namespace,
  actions: [
    {
      order: 10,
      name: "List All Namespaces",
      async act(actionContext: ActionContext) {
        this.setColumnWidths && this.setColumnWidths("25%", "35%", "40%")
        this.onOutput && this.onOutput([["Namespace", "Labels", "Created / Status"]], ActionOutputStyle.TableWithHealth)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        for(const i in clusters) {
          const output : ActionOutput  = []
          const cluster = clusters[i]
          output.push([">Cluster: " + cluster.name])
          const namespaces = await k8sFunctions.getClusterNamespaces(cluster.k8sClient)
          namespaces.forEach(ns => output.push([ns.name, ns.labels, [ns.creationTimestamp, ns.status]]))
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      }
    },
  ]
}

export default plugin
