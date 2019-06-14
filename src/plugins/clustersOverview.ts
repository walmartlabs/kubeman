/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import K8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      name: "Clusters Overview",
      order: 1,

      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput && this.onOutput([["Cluster", "Info"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const cluster of clusters) {
          const output: ActionOutput = []
          const clusterInfo = {}
          const nodes = await K8sFunctions.getClusterNodes(cluster.name, cluster.k8sClient)
          clusterInfo['nodeCount'] = nodes.length
          if(nodes.length > 0) {
            const node = nodes[0]
            clusterInfo['clusterURL'] = node.baseUrl
            clusterInfo['containerRuntimeVersion'] = node.info.containerRuntimeVersion
            clusterInfo['kubernetesVersion'] = node.info.kubeletVersion
            clusterInfo['nodesOS'] = node.info.osImage
            clusterInfo['nodeIPs'] = nodes.map(n => n.name + ": " + n.network.InternalIP)

            let versionLabel: string|undefined = undefined
            if(cluster.hasIstio) {
              const istioPilotDeployment = await K8sFunctions.getDeploymentDetails(cluster.name, "istio-system",
                                                  "istio-pilot", cluster.k8sClient)
              versionLabel = istioPilotDeployment && istioPilotDeployment.template && istioPilotDeployment.template.labels ? 
                                Object.keys(istioPilotDeployment.template.labels)
                                .filter(l => l.includes("version"))
                                .map(l => istioPilotDeployment.template.labels[l])[0] : undefined
              if(istioPilotDeployment && (!versionLabel || versionLabel.length === 0)) {
                versionLabel = istioPilotDeployment.template.containers[0].image
              }
              if(versionLabel) {
                const pieces = versionLabel.split(":")
                versionLabel = pieces[pieces.length-1]
              }
            }
            clusterInfo['istioVersion'] = versionLabel ? versionLabel : "Not Installed"
          }
          output.push([cluster.name, clusterInfo])
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
  ]
}

export default plugin
