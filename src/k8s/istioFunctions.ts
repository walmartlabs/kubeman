import jsonUtil from '../util/jsonUtil'
import {K8sClient} from './k8sClient'
import K8sFunctions from '../k8s/k8sFunctions';

export default class IstioFunctions {

  private static extractResource(result: any, ...specKeys) {
    const getResource = (obj) => {
      const resource = {
        ...K8sFunctions.extractMetadata(obj)
      }
      specKeys.forEach(key => obj.spec[key] && (resource[key] = obj.spec[key]))
      return resource
    }
    if(result && result.body) {
      if(result.body.items) {
        return result.body.items.map(getResource)
      } else {
        return getResource(result.body)
      }
    }
    return []
  }

  static listAllGateways = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.gateways.get(),
                              "selector", "servers") as any[]
  }

  static listAllIngressGateways = async (k8sClient: K8sClient) => {
    return (await IstioFunctions.listAllGateways(k8sClient) as any[])
            .filter(gateway => gateway.selector.istio === 'ingressgateway')
  }

  static listAllEgressGateways = async (k8sClient: K8sClient) => {
    return (await IstioFunctions.listAllGateways(k8sClient) as any[])
            .filter(gateway => gateway.selector.istio === 'egressgateway')
  }

  static listAllVirtualServices = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.virtualservices.get(),
                            "gateways", "hosts", "http", "tls") as any[]
  }

  static listAllIngressVirtualServices = async (k8sClient: K8sClient) => {
    const ingressGateways = (await IstioFunctions.listAllIngressGateways(k8sClient))
                            .map(g => g.name)
    return (await IstioFunctions.listAllVirtualServices(k8sClient))
            .filter(v => v.gateways && v.gateways.filter(g => 
              ingressGateways.filter(ig => g.includes(ig)).length > 0).length > 0)
  }

  static listAllEgressVirtualServices = async (k8sClient: K8sClient) => {
    const ingressGateways = (await IstioFunctions.listAllEgressGateways(k8sClient))
                            .map(g => g.name)
    return (await IstioFunctions.listAllVirtualServices(k8sClient))
            .filter(v => v.gateways && v.gateways.filter(g => ingressGateways.includes(g)).length > 0)
  }

  static listAllDestinationRules = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.destinationrules.get(),
                                  "host", "trafficPolicy", "subsets") as any[]
  }

  static listAllServiceEntries = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.serviceentries.get(),
                      "hosts", "addresses", "ports", "location", "resolution", "endpoints") as any[]
  }

  static listAllEnvoyFilters = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.envoyfilters.get(),
                                "workloadLabels", "filters") as any[]
  }

  static listAllPolicies = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.policies.get(),
            "targets", "peers", "peerIsOptional", "origins", 
            "originIsOptional", "principalBinding") as any[]
  }

  static listAllMeshPolicies = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.meshpolicies.get(),
            "targets", "peers", "peerIsOptional", "origins", 
            "originIsOptional", "principalBinding") as any[]
  }

  static listAllRules = async (k8sClient: K8sClient) => {
    return IstioFunctions.extractResource(await k8sClient.istio.rules.get(),
                                "match", "actions") as any[]
  }

  static getMtlsStatus = async (k8sClient: K8sClient) => {
    let isGlobalMtlsEnabled: boolean = false
    const namespacesWithDefaultMtls: string[] = []
    const servicesWithMtls: any[] = []

    const defaultMeshPolicy = (await IstioFunctions.listAllMeshPolicies(k8sClient))
            .filter(policy => policy.name === 'default')
    if(defaultMeshPolicy && defaultMeshPolicy.length > 0) {
      isGlobalMtlsEnabled = true
    }

    const policies = await IstioFunctions.listAllPolicies(k8sClient)
    const namespaceDefaultPolicies = policies && policies.length ? 
                policies.filter(policy => policy.name === 'default' 
                && policy.peers && policy.peers.filter(peer => peer.mtls).length > 0) : []
    namespaceDefaultPolicies.forEach(policy => namespacesWithDefaultMtls.push(policy.namespace))
    const serviceMtlsPolicies = policies && policies.length ? 
                policies.filter(policy => policy.name !== 'default'
                && policy.peers && policy.peers.filter(peer => peer.mtls).length > 0) : []
    serviceMtlsPolicies.forEach(policy => policy.targets.forEach(target => 
          servicesWithMtls.push({
            name: target.name,
            namespace: policy.namespace,
            mode: policy.peers.filter(peer => peer.mtls)[0].mtls.mode
          })))

    return {
      isGlobalMtlsEnabled,
      namespacesWithDefaultMtls,
      servicesWithMtls
    }
  }

}
