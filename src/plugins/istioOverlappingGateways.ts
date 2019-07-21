/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions';


const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  order: ActionContextOrder.Istio+1,
  actions: [
    {
      name: "Find Overlapping Gateways",
      order: 10,
      async act(actionContext) {
        this.onOutput && this.onOutput([["Overlapping Gateways"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          const output: ActionOutput = []
          output.push([">Cluster: " + cluster.name])
          if(cluster.hasIstio) {
            const gateways = await IstioFunctions.listAllIngressGateways(cluster.k8sClient)
            const gatewayServerCombis = _.flatten(gateways.map(g => g.servers.map(s => {
              return {gateway: g, server: s}
            })))
            const portHostGatewayMap = {}
            gatewayServerCombis.forEach(gs => {
              portHostGatewayMap[gs.server.port.number] = portHostGatewayMap[gs.server.port.number] || {}
              gs.server.hosts.forEach(host => {
                portHostGatewayMap[gs.server.port.number][host] = portHostGatewayMap[gs.server.port.number][host] || []
                portHostGatewayMap[gs.server.port.number][host].push(gs.gateway)
              })
            })
            let count = 0
            Object.keys(portHostGatewayMap).forEach(port => {
              Object.keys(portHostGatewayMap[port]).forEach(host => {
                if(portHostGatewayMap[port][host].length > 1) {
                  count++
                  output.push([">>Host: " + host + " in multiple gateways for port " + port])
                  portHostGatewayMap[port][host].forEach(g => output.push([">>>Gateway: " + g.name+"."+g.namespace], [g.yaml]))
                }
              })
            })
            count === 0 && output.push(["No overlapping gateways"])
          } else {
            output.push(["Istio not installed"])
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      }
    },
  ]
}

export default plugin
