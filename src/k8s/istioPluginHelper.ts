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

  static async chooseEnvoyProxy(min: number = 1, max: number = 1, actionContext: ActionContext) {
    ChoiceManager.prepareCachedChoices(actionContext, 
      async (cluster, namespace, k8sClient) => {
        const proxies = (namespace && namespace.length > 0) ?
                          await IstioFunctions.getNamespaceEnvoyProxies(namespace, k8sClient)
                          : await IstioFunctions.getAllEnvoyProxies(k8sClient)
        return proxies.map(s => {
                  s['title'] = s.pod+"."+s.namespace
                  return s
                })
      }, "Envoy Proxies", min, max, true, "title")
  }

  static getSelectedEnvoyProxies(actionContext: ActionContext) {
    const selections = ChoiceManager.getSelections(actionContext)
    return selections.map(s => {
      s.item.cluster = s.cluster
      return s.item
    })
  }

  static async chooseIstioCRDs(min: number = 1, max: number = 10, actionContext: ActionContext) {
    await ChoiceManager.prepareCachedChoices(actionContext, 
      async (cluster, namespace,k8sClient) => {
        return k8sClient.istio ? k8sClient.istio.crds : []
      }, "Istio CRDs", 1, 10, false)
  }
  static getServicesFromIstioEnabledClusters: GetItemsFunction = async (cluster, namespace, k8sClient) => {
    if(k8sClient.istio) {
      return K8sFunctions.getServices(cluster, namespace, k8sClient)
    } else {
      return []
    }
  }

  static async chooseIngressGatewayPods(min: number = 1, max: number = 1, actionContext: ActionContext) {
    ChoiceManager.prepareCachedChoices(actionContext, 
      async (cluster, namespace, k8sClient) => {
        return await IstioFunctions.getIngressGatewayPods(k8sClient)
      }, "IngressGateway Pods", min, max, false, "name")
  }

  static async choosePilotPods(min: number = 1, max: number = 1, actionContext: ActionContext) {
    ChoiceManager.prepareCachedChoices(actionContext, 
      async (cluster, namespace, k8sClient) => {
        return await IstioFunctions.getPilotPods(k8sClient)
      }, "Pilot Pods", min, max, false, "name")
  }

}