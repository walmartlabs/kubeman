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

      choose(actionContext) {
        ChoiceManager.chooseServiceAndIngressPod(this, actionContext)
      },

      async act(actionContext) {
        const selections = await ChoiceManager.getDoubleSelections(actionContext)
        const svcSelections = selections[0]
        const podSelections = selections[1]
        this.onOutput && this.onOutput([["IngressGateway Envoy Config for Service"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        
        for(const svcSelection of svcSelections) {
          const service = svcSelection.item
          const namespace = svcSelection.namespace
          const cluster = actionContext.getClusters().filter(c => c.name === svcSelection.cluster)[0]
          if(!cluster.canPodExec) {
            this.onStreamOutput && this.onStreamOutput([["Lacking pod command execution privileges"]])
            continue
          }

          let output: ActionOutput = []
          output.push([">Service: " + service.name + "." + namespace + " @ " + cluster.name])
          await outputIngressVirtualServicesAndGatewaysForService(service.name, service.namespace, cluster.k8sClient, output)
          this.onStreamOutput && this.onStreamOutput(output)

          for(const podSelection of podSelections) {
            output = []
            const configsByType = await IstioFunctions.getIngressPodEnvoyConfigsForService(podSelection.podName, service, cluster.k8sClient)
            Object.keys(configsByType).forEach(configType => {
              output.push([">>Relevant IngressGateway " + configType + " from pod " + podSelection.podName])
              const configs = configsByType[configType]
              configs.length === 0 && output.push(["No " + configType + " configs"])
              configs.forEach(c => {
                output.push([">>>"+c.title])
                output.push([c])
              })
            })
            this.onStreamOutput && this.onStreamOutput(output)
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "IngressGateway Envoy Config for FQDN",
      order: 41,

      choose: ChoiceManager.chooseIngressGatewayPods.bind(ChoiceManager, 1, 2),

      async act(actionContext) {
        this.clear && this.clear(actionContext)
      },

      clear() {
        this.onOutput && this.onOutput([["Enter /<fqdn> as command to check IngressGateway Envoy config",]], ActionOutputStyle.Table)
      },

      async react(actionContext) {
        const input = actionContext.inputText && actionContext.inputText.trim()
        this.onOutput && this.onOutput([[
          input ? "IngressGateway Envoy config for FQDN: " + input : "No FQDN entered"
        ]], ActionOutputStyle.Table)
        if(!input) return

        this.showOutputLoading && this.showOutputLoading(true)
        const fqdns = input.split(",").map(s => s.trim()).filter(s => s.length > 0)
        const podSelections = await ChoiceManager.getPodSelections(actionContext, false)

        for(const fqdn of fqdns) {
          for(const podSelection of podSelections) {
            const output: ActionOutput = []
            output.push([">Fqdn: " + fqdn + ", Ingress Pod: " + podSelection.podName])
            if(!podSelection.k8sClient.canPodExec) {
              output.push(["Lacking pod command execution privileges"])
            } else {
              await outputIngressVirtualServicesAndGatewaysForFqdn(fqdn, podSelection.k8sClient, output)

              const configs = await IstioFunctions.getIngressPodEnvoyConfigsForFqdn(podSelection.podName, fqdn, podSelection.k8sClient)
              Object.keys(configs).forEach(configType => {
                output.push([">>Relevant " + configType + " from IngressGateway Pod: " + podSelection.podName])
                const config = configs[configType]
                config.length === 0 && output.push(["No " + configType + " configs"])
                config.forEach(c => {
                  output.push([">>>"+c.title])
                  output.push([c])
                })
              })
            }
            this.onStreamOutput && this.onStreamOutput(output)
          }
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
