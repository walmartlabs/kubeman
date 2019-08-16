/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'
import JsonUtil from '../util/jsonUtil';
import KubectlClient from '../k8s/kubectlClient'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      name: "Get Nodes Details",
      order: 2,
      async act(actionContext) {
        this.setColumnWidths && this.setColumnWidths("35%", "35%", "30%")
        const clusters = actionContext.getClusters()
        this.onOutput && this.onOutput([[
          "Labels",
          "Info",
          "Conditions",
        ]], ActionOutputStyle.TableWithHealth)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const i in clusters) {
          const output: ActionOutput = []
          const cluster = clusters[i]
          output.push([">Cluster: " + cluster.name, "", ""])
          const nodes = await k8sFunctions.getClusterNodes(cluster.name, cluster.k8sClient)
          if(nodes.length > 0) {
            output.push(["++", "Cluster URL: " + nodes[0].baseUrl, "", ""])
          }
          nodes.forEach(node => {
            output.push([">>Node: " + node.name + " Created: "+node.creationTimestamp, "", ""])
            const nodeInfo = JsonUtil.flattenObject(node.info)
            let nodeLabels = {
              annotations: JsonUtil.convertObjectToArray(node.annotations),
              labels: JsonUtil.convertObjectToArray(node.labels),
              taints: node.taints
            }
            output.push([
              "<<", nodeLabels,
              Object.keys(node.network)
                    .map(key => key + ": " + node.network[key])
                    .concat(Object.keys(nodeInfo)
                        .map(key => key + ": " + nodeInfo[key])),
              Object.keys(node.condition).map(key => 
                    key + ": " + node.condition[key].status +
                    " (" + node.condition[key].message + ")"),
            ])
          })
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
    {
      name: "Nodes CPU/Memory Usage",
      order: 3,
      autoRefreshDelay: 15,
      
      async act(actionContext) {
        this.clear && this.clear(actionContext)
        const clusters = actionContext.getClusters()
        this.showOutputLoading && this.showOutputLoading(true)

        for(const i in clusters) {
          const output: ActionOutput = []
          const cluster = clusters[i]
          output.push([">Cluster: " + cluster.name])
          if(cluster.hasKubectl) {
            try {
              const results = await KubectlClient.getTopNodes(cluster)
              results.forEach(item => output.push(["<<", ...item]))
              results.length === 0 && output.push(["<<", "Couldn't get top nodes"])
            } catch(error) {
              output.push([error])
            }
          } else {
            output.push(["No kubectl access"])
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([["Top Nodes"]], ActionOutputStyle.Mono)
      },
    },
  ]
}

export default plugin
