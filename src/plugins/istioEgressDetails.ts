/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "More Istio Recipes",
  actions: [
    {
      name: "View Egress Details",
      order: 102,
      
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput && this.onOutput([["", "Istio EgressGateway Details"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name, ""]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["", "Istio not installed"]])
            continue
          }
          const output: ActionOutput = []
          const k8sClient = cluster.k8sClient
          const egressDeployment = await K8sFunctions.getDeploymentDetails(cluster.name, 
                                      "istio-system", "istio-egressgateway", k8sClient)
          if(!egressDeployment) {
            this.onStreamOutput && this.onStreamOutput(["istio-egressgateway not found", ""])
            continue
          } 
          output.push(["Replicas", egressDeployment.replicas])
          const podTemplate = egressDeployment.template
          const istioProxyContainer = podTemplate.containers.filter(c => c.name === "istio-proxy")[0]
          output.push(["Docker Image", istioProxyContainer.image])
          output.push(["Ports", istioProxyContainer.ports ? 
                        istioProxyContainer.ports.map(port => port.containerPort).join(", ") : ""])
          output.push(["Resources", istioProxyContainer.resources || ""])
          output.push(["Replicas Available/Ready", egressDeployment.status.availableReplicas
                                                    + "/" + egressDeployment.status.readyReplicas])

          const egressService = (await IstioFunctions.getIstioServiceDetails("istio=egressgateway", k8sClient))[0]
          egressService && output.push(["Egress Service", egressService.yaml])
          output.push(["Egress Pods", await IstioFunctions.getIngressGatewayPods(k8sClient)])
          output.push(["Egress Gateways", await IstioPluginHelper.getIstioEgressGateways(k8sClient)])
          output.push(["Egress VirtualServices", await IstioFunctions.listAllEgressVirtualServices(k8sClient)])

          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
