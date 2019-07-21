/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'
import OutputManager from '../output/outputManager'
import KubectlClient from '../k8s/kubectlClient'
import { ServiceInfo } from '../k8s/k8sObjectTypes'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      name: "Find Component By IP",
      order: 15,
      async act(actionContext) {
        this.clear && this.clear(actionContext)
      },
      async react(actionContext) {
        this.onOutput && this.onOutput([[
          "Component", "Cluster", "Namespace", "IP"
        ]], ActionOutputStyle.Table)

        const ipAddresses = actionContext.inputText ? actionContext.inputText.split(",").map(value => value.trim()) : []

        ipAddresses.length > 0 && OutputManager.filter(ipAddresses.join(" or "))
        OutputManager.setShowAllGroupsInSearch(true)

        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          this.onStreamOutput && this.onStreamOutput([[">Cluster: " + cluster.name, "", "", ""]])
          const nodes = await k8sFunctions.getClusterNodes(cluster.name, cluster.k8sClient)
          const matchingNodes = nodes.filter(node => Object.values(node.network).filter((value: any) => 
                                    ipAddresses.includes(value ? value.toString() : '')).length > 0)
          if(matchingNodes.length > 0) {
            this.onStreamOutput && this.onStreamOutput([[">>Nodes", "", "", ""]])
            matchingNodes.forEach(node => {
              this.onStreamOutput && this.onStreamOutput([[
                node.name, cluster.name, "", node.network
              ]])
            })
          } else {
            this.onStreamOutput && this.onStreamOutput([[">>No Matching Nodes", "", "", ""]])
          }

          let services: ServiceInfo[] = cluster.hasKubectl ? await KubectlClient.getServices(cluster) :
                          (await k8sFunctions.getClusterServices(cluster.k8sClient) as any[])
          const matchingServices = services.filter(s => ipAddresses.includes(s.clusterIP))
          if(matchingServices.length > 0) {
            this.onStreamOutput && this.onStreamOutput([[">>Services", "", "", ""]])
            matchingServices.forEach(service => {
              this.onStreamOutput && this.onStreamOutput([[
                service.name, cluster.name, service.namespace, {clusterIP: service.clusterIP}
              ]])
            })
          } else {
            this.onStreamOutput && this.onStreamOutput([[">>No Matching Services", "", "", ""]])
          }

          const pods = cluster.hasKubectl ? await KubectlClient.getPods(cluster) :
                                await k8sFunctions.getAllClusterPods(cluster.k8sClient)
          const matchingPods = pods.filter(pod => ipAddresses.includes(pod.podIP))
          if(matchingPods.length > 0) {
            this.onStreamOutput && this.onStreamOutput([[">>Pods", "", "", ""]])
            matchingPods.forEach(pod => {
              this.onStreamOutput && this.onStreamOutput([[
                pod.name, cluster.name, pod.namespace, {podIP: pod.podIP, hostIP: pod.hostIP, nodeName: pod.nodeName}
              ]])
            })
          } else {
            this.onStreamOutput && this.onStreamOutput([[">>No Matching Pods", "", "", ""]])
          }
        }
      },
      clear() {
        this.onOutput && this.onOutput([[
          "Enter /<ip address>,<ip address>... as command to find components by IP",
        ]], ActionOutputStyle.Table)
      },
      refresh(actionContext) {
        this.react && this.react(actionContext)
      },
    },
  ]
}

export default plugin
