/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import IstioFunctions from '../k8s/istioFunctions';

async function outputIngressGatewaysAndVirtualServices(k8sClient, output) {
  const gateways = await IstioFunctions.listAllIngressGateways(k8sClient, false)
  output.push([">>Gateways"])
  gateways.length === 0 && output.push(["No Gateways"])
  gateways.forEach(g => {
    output.push([">>>"+g.name+"."+g.namespace])
    output.push([g])
  })

  const virtualServices = await IstioFunctions.listAllIngressVirtualServices(k8sClient, false)
  output.push([">>VirtualServices"])
  virtualServices.length === 0 && output.push(["No VirtualServices"])
  virtualServices.forEach(vs => {
    output.push([">>>"+vs.name+"."+vs.namespace])
    output.push([vs])
  })
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  order: ActionContextOrder.Istio+1,
  actions: [
    {
      name: "View Ingress Details",
      order: 1,
      
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput &&
          this.onOutput([["Istio IngressGateway Details"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["Istio not installed"]])
            continue
          }
          const output: ActionOutput = []
          const k8sClient = cluster.k8sClient
          const ingressDeployment = await K8sFunctions.getDeploymentDetails(cluster.name, 
                                      "istio-system", "istio-ingressgateway", k8sClient)
          if(!ingressDeployment) {
            this.onStreamOutput && this.onStreamOutput(["istio-ingressgateway not found"])
            continue
          } 
          output.push(["Replicas: " + ingressDeployment.replicas])

          const ingressService = (await IstioFunctions.getIstioServiceDetails("istio=ingressgateway", k8sClient))[0]
          const ingressServiceYaml = ingressService.yaml
          delete ingressService.yaml
          output.push([">>IngressGateway Service Details"])
          output.push([ingressService])

          const podTemplate = ingressDeployment.template
          const istioProxyContainer = podTemplate.containers.filter(c => c.name === "istio-proxy" 
                                      || c.name === 'ingressgateway')[0]

          output.push([">>Containers"])
          output.push([">>>Istio-Proxy Container"])
          output.push([istioProxyContainer])

          const istioSDSContainer = podTemplate.containers.filter(c => c.name === "ingress-sds")[0]
          if(istioSDSContainer) {
            output.push([">>>SDS Container"])
            output.push([istioSDSContainer])
          }

          const pods = await IstioFunctions.getIngressGatewayPods(k8sClient)
          output.push([">>Pods"])
          pods.length === 0 && output.push(["No Pods"])
          pods.forEach(pod => {
            output.push([">>>"+pod.name])
            output.push([pod])
          })

          await outputIngressGatewaysAndVirtualServices(k8sClient, output)

          output.push([">>Service and Deployment YAMLs"])
          output.push([">>>Ingress Service Yaml"])
          output.push([ingressServiceYaml])

          output.push([">>>Ingress Deployment Yaml"])
          output.push([ingressDeployment.yaml])

          this.onStreamOutput  && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
    {
      name: "View Ingress Gateways and VirtualServices ",
      order: 2,
      
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput &&
          this.onOutput([["Ingress Gateways and VirtualServices"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["Istio not installed"]])
            continue
          }
          const output: ActionOutput = []
          const k8sClient = cluster.k8sClient
          await outputIngressGatewaysAndVirtualServices(k8sClient, output)
          this.onStreamOutput  && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
