/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions'
import K8sFunctions from '../k8s/k8sFunctions'


const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  order: ActionContextOrder.Istio+1,
  actions: [
    {
      name: "Gateways with Missing Secrets",
      order: 13,
      async act(actionContext) {
        this.onOutput && this.onOutput([["Gateways with Missing Secrets"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          const output: ActionOutput = []
          output.push([">Cluster: " + cluster.name])
          if(cluster.hasIstio) {
            const gateways = await IstioFunctions.listAllIngressGateways(cluster.k8sClient)
            const gatewaySecretCombis = _.flatten(gateways.map(g => 
              g.servers.filter(s => s.tls && s.tls.credentialName)
              .map(s => {
                return {gateway: g, secret: s.tls.credentialName}
              })))

            const istioSystemSecrets = await K8sFunctions.getNamespaceSecrets(cluster.name, "istio-system", cluster.k8sClient)
            const secretsMap = {}
            istioSystemSecrets.forEach(s => secretsMap[s.name]=s)
            
            const invalidGatewaySecrets = {}
            for(const gs of gatewaySecretCombis) {
              if(!secretsMap[gs.secret]) {
                const gatewayTitle = gs.gateway.name+"."+gs.gateway.namespace
                invalidGatewaySecrets[gatewayTitle] = invalidGatewaySecrets[gatewayTitle] || []
                invalidGatewaySecrets[gatewayTitle].push(gs.secret)
              }
            }
            let count = 0
            Object.keys(invalidGatewaySecrets).forEach(gateway => {
              count++
              output.push([">>Gateway: " + gateway])
              invalidGatewaySecrets[gateway].forEach(secret => output.push(["Secret: " + secret]))
            })
            count === 0 && output.push(["No gateways with missing secrets"])
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
