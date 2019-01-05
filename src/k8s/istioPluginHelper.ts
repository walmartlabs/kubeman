import {ActionOutput} from '../actions/actionSpec'
import { K8sClient } from '../k8s/k8sClient'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import JsonUtil from '../util/jsonUtil';

export default class IstioPluginHelper {

  static async getIstioServiceDetails(labelSelector: string, k8sClient: K8sClient) {
    const services = await K8sFunctions.getServicesByLabels("istio-system", labelSelector, k8sClient)
    return services.map(service => {
      return {
        name: service.name,
        type: service.type,
        clusterIP: service.clusterIP,
        externalIPs: service.externalIPs,
        externalName: service.externalName,
        healthCheckNodePort: service.healthCheckNodePort,
        'loadBalancer.ingress': service.loadBalancer?service.loadBalancer.ingress:"",
        loadBalancerIP: service.loadBalancerIP,
        loadBalancerSourceRanges: service.loadBalancerSourceRanges,
        ports: service.ports.map(port => "["+port.name+", "+port.protocol+", "
                  +(port.nodePort?port.nodePort+"->":"")
                  +(port.port?port.port:"")
                  +(port.targetPort?"->"+port.targetPort:"")
                  +"]"),
        selector: service.selector,
    }})
  }

  static async getIstioServicePods(labelSelector: string, k8sClient: K8sClient, loadDetails: boolean = false) {
    const ingressPods = await K8sFunctions.getPodsByLabels("istio-system", labelSelector, k8sClient)
    return ingressPods.map(pod => {
      return {
        name: pod.name,
        podIP: pod.podIP,
        hostIP: pod.hostIP,
        startTime: pod.startTime,
        conditions: pod.conditions,
        podDetails: loadDetails ? pod : undefined
      }
    })
  }

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

  static extractVirtualServicesDetails(virtualServices: any[]) {
    return virtualServices.map(virtualService => {
      return {
        name: virtualService.name,
        namespace: virtualService.namespace,
        gateways: virtualService.gateways,
        hosts: virtualService.hosts,
        http: JsonUtil.flattenObject(virtualService.http),
        tls: JsonUtil.flattenObject(virtualService.tls),
        tcp: JsonUtil.flattenObject(virtualService.tcp),
      }})
  }
  
  static async getAllVirtualServices(k8sClient: K8sClient) {
    return IstioPluginHelper.extractVirtualServicesDetails(await IstioFunctions.listAllVirtualServices(k8sClient))
  }
  
  static async getIstioIngressVirtualServices(k8sClient: K8sClient) {
    return IstioPluginHelper.extractVirtualServicesDetails(await IstioFunctions.listAllIngressVirtualServices(k8sClient))
  }
  
  static async getIstioEgressVirtualServices(k8sClient: K8sClient) {
    return IstioPluginHelper.extractVirtualServicesDetails(await IstioFunctions.listAllEgressVirtualServices(k8sClient))
  }
}