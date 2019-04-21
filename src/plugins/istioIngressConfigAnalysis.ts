import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import ActionContext from '../actions/actionContext'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import EnvoyFunctions, {EnvoyConfigType} from '../k8s/envoyFunctions'
import {compareEnvoyConfigs} from './envoySidecarConfigComparison'
import { K8sClient } from '../k8s/k8sClient'
import {matchSubsetHosts} from '../util/matchUtil'

export async function outputIngressVirtualServicesAndGatewaysForFqdn(fqdn: string, k8sClient: K8sClient, output, asGroup: boolean = false) {
  const virtualServices = await IstioFunctions.getVirtualServicesForFqdn(fqdn, k8sClient)
  return outputIngressVirtualServicesAndGateways(virtualServices, k8sClient, output, asGroup)
}

export async function outputIngressVirtualServicesAndGatewaysForService(service: string, namespace: string, k8sClient: K8sClient, output, asGroup: boolean = false) {
  const virtualServices = await IstioFunctions.getVirtualServicesForService(service, namespace, k8sClient)
  return outputIngressVirtualServicesAndGateways(virtualServices, k8sClient, output, asGroup)
}

async function outputIngressVirtualServicesAndGateways(virtualServices: any[], k8sClient: K8sClient, output, asGroup: boolean = false) {
  const gateways = await IstioFunctions.getGatewaysForVirtualServices(virtualServices, k8sClient)
  output.push([(asGroup?">":">>") + "Relevant VirtualServices + Gateways: "])
  virtualServices.length === 0 && output.push(["No VirtualServices/Gateways"])
  
  const ingressCerts: {[key: string] : string} = {}
  virtualServices.forEach(vs => {
    const vsGateways = gateways.map(g => {
      const matchingServers = g.servers
      .filter(server => server.port && 
        (vs.http && server.port.protocol === 'HTTP') ||
        (vs.tls && server.port.protocol === 'HTTPS') ||
        (vs.tcp && server.port.protocol === 'TCP'))
      .filter(server => server.hosts && matchSubsetHosts(server.hosts, vs.hosts))
      if(matchingServers.length > 0) {
        if(g.selector && g.selector.istio && g.selector.istio === 'ingressgateway') {
          matchingServers.filter(s => s.tls && s.tls.serverCertificate && s.tls.privateKey)
            .forEach(s => ingressCerts[s.tls.privateKey]=s.tls.serverCertificate)
        }
        const gateway = {...g}
        g.matchingPorts = _.uniqBy((g.matchingPorts || []).concat(matchingServers.map(s => s.port.number)))
        return gateway
      } else {
        return {}
      }
    }).filter(g => g.name)

    const gateway = vsGateways.length > 0 ? vsGateways[0] : undefined
    delete vs.yaml
    const vsTitle = vs.name+"."+vs.namespace
    const gatewayTitle = gateway ? gateway.name+"."+gateway.namespace : "None"
    output.push([">>>VirtualService: " + vsTitle + (gateway ? " via Gateway: " + gatewayTitle : "")])
    gateway && output.push(["++", "VirtualService: " + vsTitle])
    output.push([vs])
    gateway && output.push(["++", "Gateway: " + gatewayTitle]),
    gateway && output.push([gateway])
  })
  return {
    virtualServices,
    gateways,
    ingressCerts: Object.keys(ingressCerts).map(key => [key, ingressCerts[key]])
  }
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "Compare Envoy Configs of IngressGateway Pods",
      order: 30,
      loadingMessage: "Loading IngressGateway Pods...",

      async choose(actionContext) {
        await ChoiceManager.chooseServicePods("istio-ingressgateway", "istio-system", 
                      2, 2, false, true, actionContext)
      },

      async act(actionContext) {
        const selections = await ChoiceManager.getPodSelections(actionContext, false)
        this.onOutput && this.onOutput([["IngressGateway Sidecar Config Comparison", ""]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const pod1 = selections[0]
        const cluster1 = actionContext.getClusters().filter(c => c.name === pod1.cluster)[0]
        const ingress1Configs = await EnvoyFunctions.getEnvoyConfigDump(cluster1.k8sClient, pod1.namespace, pod1.podName, "istio-proxy")
        const pod1Details = await K8sFunctions.getPodDetails(pod1.namespace, pod1.podName, cluster1.k8sClient)
        const pod1IP = pod1Details && pod1Details.podIP

        const pod2 = selections[1]
        const cluster2 = actionContext.getClusters().filter(c => c.name === pod2.cluster)[0]
        const ingress2Configs = await EnvoyFunctions.getEnvoyConfigDump(cluster2.k8sClient, pod2.namespace, pod2.podName, "istio-proxy")
        const pod2Details = await K8sFunctions.getPodDetails(pod2.namespace, pod2.podName, cluster2.k8sClient)
        const pod2IP = pod2Details && pod2Details.podIP
        
        const keysToIgnore: string[] = ["uid"]

        const valuesToIgnore: string[] = []
        pod1IP && valuesToIgnore.push(pod1IP)
        pod2IP && valuesToIgnore.push(pod2IP)

        compareEnvoyConfigs(this.onStreamOutput, ingress1Configs, ingress2Configs, EnvoyConfigType.Clusters, false, "cluster", "cluster", keysToIgnore, valuesToIgnore)

        compareEnvoyConfigs(this.onStreamOutput, ingress1Configs, ingress2Configs, EnvoyConfigType.Listeners, false, "listener", "listener", keysToIgnore, valuesToIgnore)

        compareEnvoyConfigs(this.onStreamOutput, ingress1Configs, ingress2Configs, EnvoyConfigType.Routes, false, "route_config", "route_config", keysToIgnore, valuesToIgnore)

        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    }
  ]
}

export default plugin
