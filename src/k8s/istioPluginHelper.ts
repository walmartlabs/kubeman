import { K8sClient } from '../k8s/k8sClient'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import { ServiceDetails, PodDetails } from './k8sObjectTypes';

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
  
  static async getAllVirtualServices(k8sClient: K8sClient) {
    return await IstioFunctions.listAllVirtualServices(k8sClient)
  }
  
  static async getIstioIngressVirtualServices(k8sClient: K8sClient) {
    return await IstioFunctions.listAllIngressVirtualServices(k8sClient)
  }
  
  static async getIstioEgressVirtualServices(k8sClient: K8sClient) {
    return await IstioFunctions.listAllEgressVirtualServices(k8sClient)
  }

  static async checkServiceReachabilityFromIngress(service: ServiceDetails,
                  namespace: string, k8sClient: K8sClient, onStreamOutput) {
    const podsAndContainers = await K8sFunctions.getPodsAndContainersForService(
                                      namespace, service, k8sClient, true)
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
    const sourceIngressContainer = sourceIngressPod.podDetails && sourceIngressPod.podDetails.containers 
                                    && sourceIngressPod.podDetails.containers.length > 0 ? 
                                    sourceIngressPod.podDetails.containers[0].name : "istio-proxy"
    try {
      const servicePods = podsAndContainers.pods as PodDetails[]
      onStreamOutput([[">>Pods Reachability"]])
      for(const pod of servicePods) {
        if(pod.podIP) {
          const result = await K8sFunctions.podExec("istio-system", sourceIngressPod.name, 
                              sourceIngressContainer, k8sClient, ["ping", "-c 2", pod.podIP])
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

      onStreamOutput([[">>mTLS Status"]])
      const serviceMtlsStatuses = await IstioFunctions.getServiceMtlsStatuses(k8sClient, service.name, namespace)
      const ingressMtlsStatuses = await IstioFunctions.getServiceMtlsStatuses(k8sClient, "istio-ingressgateway", "istio-system")

      let serviceUsingMtls = false, ingressUsingMtls = false
      ingressMtlsStatuses.forEach(ingressMtlsStatus => {
        ingressUsingMtls = ingressUsingMtls || ingressMtlsStatus.clientProtocol.toLowerCase().includes("mtls")
                            || ingressMtlsStatus.serverProtocol.toLowerCase().includes("mtls")
      })
      ingressUsingMtls && onStreamOutput([["IngressGateway Uses mTLS"]])
      
      serviceMtlsStatuses.forEach(serviceMtlsStatus => {
        onStreamOutput([[[
          "Service Port " + serviceMtlsStatus.port,
          "Service Client Protocol: " + serviceMtlsStatus.clientProtocol,
          "Service Server Protocol: " + serviceMtlsStatus.serverProtocol
        ]]])
        serviceUsingMtls = serviceUsingMtls || serviceMtlsStatus.serverProtocol.toLowerCase().includes("mtls")
      })

      if(serviceUsingMtls !== ingressUsingMtls) {
        onStreamOutput([["** mTLS mismatch between IngressGateway and Service"]])
      }
    } catch(error) {
      console.log(error)
    }
  }

  static async getServiceMtlsAccessStatus(namespace: string, serviceDetails: any, 
                                          serviceMtlsStatus: any, k8sClient: K8sClient) {
    const serviceDestinationRules = await IstioFunctions.getServiceDestinationRules(
                                              serviceDetails.name, namespace, k8sClient)
    const podsAndContainers = await K8sFunctions.getPodsAndContainersForService(namespace, serviceDetails, k8sClient)
    const containers = podsAndContainers.containers ? podsAndContainers.containers as any[] : []
    const hasSidecar = containers.filter(c => c === "istio-proxy").length > 0

    const drule = serviceDestinationRules.filter(r => r.name === serviceMtlsStatus.destinationRule)
    let isClientMtlsDisabled = false
    if(drule.length > 0 && drule[0].trafficPolicy && drule[0].trafficPolicy.tls) {
      isClientMtlsDisabled = drule[0].trafficPolicy.tls.mode === 'DISABLE'
    }
    const isServerMtlsPermissive = serviceMtlsStatus.serviceMtlsMode && serviceMtlsStatus.serviceMtlsMode.toLowerCase().includes("permissive")
    const isServerMtlsEnforced = hasSidecar && serviceMtlsStatus.serverProtocol.toLowerCase().includes("mtls")
                                && !isServerMtlsPermissive
    const isClientMtlsRequired = isServerMtlsEnforced && !isClientMtlsDisabled && hasSidecar 
                                  && serviceMtlsStatus.clientProtocol.toLowerCase().includes("mtls")
    let access = ''
    if(hasSidecar) {
      if(isServerMtlsEnforced) {
        access = "Sidecar only"
      } else {
        access = "Any client"
      }
    } else {
      if(isServerMtlsEnforced) {
        access = "Conflict. mTLS enabled without sidecar"
      } else if(!isClientMtlsDisabled) {
        access = "Non-sidecar only"
      } else {
        access = "Any client"
      }
    }
    return {
      isClientMtlsRequired,
      isClientMtlsDisabled,
      isServerMtlsEnforced,
      isServerMtlsPermissive,
      hasSidecar,
      access
    }
  }
}