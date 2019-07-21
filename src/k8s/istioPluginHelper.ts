/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import { K8sClient } from '../k8s/k8sClient'
import K8sFunctions, { GetItemsFunction } from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import { ServiceDetails, PodDetails } from './k8sObjectTypes'
import ActionContext from '../actions/actionContext'
import ChoiceManager from '../actions/choiceManager'

export default class IstioPluginHelper {

  static extractGatewayDetails(gateways: any[]) {
    return gateways.map(gateway => {
      const servers = gateway.servers.map(server => {
        server.hosts = server.hosts
        server.port = server.port.protocol + ":" + server.port.number
        return server
      })
      return {
        name: gateway.name,
        namespace: gateway.namespace,
        servers
    }})
  }

  static async getIstioIngressGateways(k8sClient: K8sClient) {
    return IstioPluginHelper.extractGatewayDetails(await IstioFunctions.listAllIngressGateways(k8sClient))
  }

  static async getIstioEgressGateways(k8sClient: K8sClient) {
    return IstioPluginHelper.extractGatewayDetails(await IstioFunctions.listAllEgressGateways(k8sClient))
  }

  static async checkServiceReachabilityFromIngress(service: ServiceDetails,
                  namespace: string, k8sClient: K8sClient, onStreamOutput) {
    if(!k8sClient.canPodExec) {
      onStreamOutput([["Lacking pod command execution privileges"]])
      return
    }
    const podsAndContainers = await K8sFunctions.getPodsAndContainersForService(service, k8sClient, true)
    if(!podsAndContainers.pods || podsAndContainers.pods.length === 0) {
      onStreamOutput([["Service has no pods"]])
      return
    }

    const ingressPods = await IstioFunctions.getIngressGatewayPods(k8sClient)
    if(!ingressPods || ingressPods.length === 0) {
      onStreamOutput([["IngressGateway not found"]])
      return
    }

    let reachablePodsCount = 0
    const sourceIngressPod = ingressPods[0]
    try {
      const servicePods = podsAndContainers.pods as PodDetails[]
      onStreamOutput([[">>Pods Reachability"]])
      for(const pod of servicePods) {
        if(pod.podIP) {
          const result = await K8sFunctions.podExec("istio-system", sourceIngressPod.name, "istio-proxy", 
                                            k8sClient, ["ping", "-c 2", pod.podIP])
          const pingSuccess = result.includes("2 received")
          pingSuccess && reachablePodsCount++
          onStreamOutput([[
            "Pod " + pod.name + (pingSuccess ? " is Reachable" : ": is Unreachable") + " from ingress gateway"
          ]])
        } else {
          onStreamOutput([["No IP for pod: " + pod.name]])
        }
      }
      onStreamOutput([["Service has " + reachablePodsCount + " pods reachable from ingress gateway"]])
    } catch(error) {
      console.log(error)
    }
  }

  static getServicesFromIstioEnabledClusters: GetItemsFunction = async (cluster, namespace, k8sClient) => {
    if(k8sClient.istio) {
      return ChoiceManager.getClusterServices(cluster, namespace, k8sClient)
    } else {
      return []
    }
  }
}