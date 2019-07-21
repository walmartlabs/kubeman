/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
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
  const vsGateways = await IstioFunctions.getIngressGatewaysForVirtualServices(virtualServices, k8sClient)
  output.push([(asGroup?">":">>") + "Relevant VirtualServices + Gateways: "])
  const vsGatewayMatchingServers = getVSAndGatewaysWithMatchingServers(vsGateways)
  vsGatewayMatchingServers.length === 0 && output.push(["No VirtualServices/Gateways"])
  const ingressCerts: {[key: string] : string} = {}
  for(const vsg of vsGatewayMatchingServers) {
    vsg.matchingServers.filter(s => s.tls && s.tls.serverCertificate && s.tls.privateKey)
        .forEach(s => ingressCerts[s.tls.privateKey]=s.tls.serverCertificate)

    const sdsCredentials = vsg.matchingServers.filter(s => s.tls && s.tls.credentialName).map(s => s.tls.credentialName)
    for(const credentialName of sdsCredentials) {
      const secret = await K8sFunctions.getNamespaceSecret(credentialName, "istio-system", k8sClient)
      if(secret) {
        ingressCerts[secret.name+"."+secret.namespace]=""
      }
      //const cert = secret && Buffer.from(secret.data.cert)
      //cert && console.log(cert.toString('base64'))
    }
    const gateway = {...vsg.gateway}
    vsg.gateway.matchingPorts = _.uniqBy((vsg.gateway.matchingPorts || []).concat(vsg.matchingServers.map(s => s.port.number)))

    delete vsg.virtualService.yaml
    const vsTitle = vsg.virtualService.name+"."+vsg.virtualService.namespace
    const gatewayTitle = gateway ? gateway.name+"."+gateway.namespace : "None"
    output.push([">>>VirtualService: " + vsTitle + (gateway ? " via Gateway: " + gatewayTitle : "")])
    gateway && output.push(["++", "VirtualService: " + vsTitle])
    output.push([vsg.virtualService])
    gateway && output.push(["++", "Gateway: " + gatewayTitle]),
    gateway && output.push([gateway])
  }

  return {
    virtualServices,
    gateways: _.uniqBy(_.flatten(vsGateways.map(vsg => vsg.gateways)), g => g.name+"."+g.namespace),
    vsGateways,
    ingressCerts
  }
}

function getVSAndGatewaysWithMatchingServers(vsGateways: any[]) {
  const vsGatewayMatchingServers: any[] = []
  vsGateways.forEach(vsg => {
      const vs = vsg.virtualService
      vsg.gateways && vsg.gateways.forEach(g => {
        const matchingServers = g.servers
          .filter(server => server.port && 
            (vs.http && server.port.protocol === 'HTTP') ||
            ((vs.http || vs.tls) && server.port.protocol === 'HTTPS') ||
            (vs.tcp && server.port.protocol === 'TCP'))
          .filter(server => server.hosts && matchSubsetHosts(server.hosts, vs.hosts))
        if(matchingServers.length > 0) {
          vsGatewayMatchingServers.push({
            virtualService: vs,
            gateway: g,
            matchingServers
          })
        }
      })
  })
  return vsGatewayMatchingServers
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "IngressGateway Config for Service",
      order: 40,
      loadingMessage: "Loading Services...",

      choose: ChoiceManager.chooseService.bind(ChoiceManager, 1, 3),

      async act(actionContext) {
        const selections: ItemSelection[] = await ChoiceManager.getServiceSelections(actionContext)
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No service selected"]], ActionOutputStyle.Text)
          return
        }
        this.onOutput && this.onOutput([["IngressGateway Envoy Config for Service"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        
        for(const selection of selections) {
          const service = selection.item
          const namespace = selection.namespace
          const cluster = actionContext.getClusters().filter(c => c.name === selection.cluster)[0]
          if(!cluster.canPodExec) {
            this.onStreamOutput && this.onStreamOutput([["Lacking pod command execution privileges"]])
            continue
          }

          const output: ActionOutput = []

          output.push([">Service: " + service.name + "." + namespace + " @ " + cluster.name])

          await outputIngressVirtualServicesAndGatewaysForService(service.name, service.namespace, cluster.k8sClient, output)

          const configsByType = await IstioFunctions.getIngressEnvoyConfigsForService(service, cluster.k8sClient)
          Object.keys(configsByType).forEach(configType => {
            output.push([">>IngressGateway " + configType + " configs relevant to this service"])
            const configs = configsByType[configType]
            configs.length === 0 && output.push(["No " + configType + " configs"])
            configs.forEach(c => {
              output.push([">>>"+c.title])
              output.push([c])
            })
          })
          this.onStreamOutput && this.onStreamOutput(output) 
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
  ]
}

export default plugin
