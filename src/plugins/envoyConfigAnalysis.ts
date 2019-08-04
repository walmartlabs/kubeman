/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import EnvoyFunctions from '../k8s/envoyFunctions'
import ChoiceManager from '../actions/choiceManager'
import IstioFunctions from '../k8s/istioFunctions'
import K8sFunctions from '../k8s/k8sFunctions';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Envoy Proxy Recipes",
  order: ActionContextOrder.Istio+3,
  actions: [
    {
      name: "Envoy Sidecar Config for Service",
      order: 40,
      loadingMessage: "Loading Envoy Proxies and Services...",

      choose(actionContext) {
        ChoiceManager.doubleChoices(this, actionContext,
          ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 3, actionContext),
          ChoiceManager.getSelectedEnvoyProxies.bind(ChoiceManager, actionContext),
          ChoiceManager.chooseService.bind(ChoiceManager,1, 3, actionContext),
          ChoiceManager.getServiceSelections.bind(ChoiceManager, actionContext)
        )
      },

      async act(actionContext) {
        this.clear && this.clear(actionContext)
        const selections = await ChoiceManager.getDoubleSelections(actionContext)
        const sidecars = selections[0]
        const services = selections[1]
        if(sidecars.length < 1) {
          this.onOutput && this.onOutput([["No sidecar selected"]], ActionOutputStyle.Text)
          return
        }
        if(services.length < 1) {
          this.onOutput && this.onOutput([["No service selected"]], ActionOutputStyle.Text)
          return
        }
        this.showOutputLoading && this.showOutputLoading(true)
        for(const sidecar of sidecars) {
          const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]
          for(const service of services) {
            const output: ActionOutput = []
            const sidecarName = sidecar.pod+"."+ sidecar.namespace
            output.push([">Service: "+service.name+"."+service.namespace + 
                          " @ Envoy Sidecar: " + sidecarName + " @ Cluster: " + sidecar.cluster])

            if(!cluster.canPodExec) {
              output.push(["Lacking pod command execution privileges"])
            } else {
              const configsByType = await EnvoyFunctions.getEnvoyConfigsForService(service.name, service.namespace,
                                            sidecar.namespace, sidecar.pod, "istio-proxy", cluster.k8sClient)

              Object.keys(configsByType).forEach(configType => {
                const items = configsByType[configType]
                output.push([">>" + configType])
                items.length === 0 && output.push(["No matching data found"])
                items.length > 0 && items.forEach(item => output.push([">>>"+ item.title], [delete item.title && item]))
              })

              const podDetails = await K8sFunctions.getPodDetails(sidecar.namespace, sidecar.pod, cluster.k8sClient)
              if(podDetails) {
                const egressSidecarConfigs = await IstioFunctions.getPodEgressSidecarConfigs(podDetails.labels, podDetails.namespace, cluster.k8sClient)
                if(egressSidecarConfigs && egressSidecarConfigs.length > 0) {
                  output.push([">>Egress Sidecar Configs for " + sidecarName])
                  egressSidecarConfigs.forEach(sc => output.push([sc.yaml]))
                } else {
                  output.push([">>No Egress Sidecar Configs found for " + sidecarName])
                }
              }
            }
            this.onStreamOutput && this.onStreamOutput(output)
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },

      clear() {
        this.onOutput && this.onOutput([["Sidecar Envoy Config for Service"]], ActionOutputStyle.Mono)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      onActionOption(actionContext, option) {
      }
    },
    {
      name: "Envoy Sidecar Config for Fqdn",
      order: 41,
      loadingMessage: "Loading Envoy Proxies...",

      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 3),

      async act(actionContext) {
        this.clear && this.clear(actionContext)
      },

      clear() {
        this.onOutput && this.onOutput([["Enter /<fqdn> as command to check sidecar config",]], ActionOutputStyle.Table)
      },

      async react(actionContext) {
        const sidecars = ChoiceManager.getSelectedEnvoyProxies(actionContext)
        if(sidecars.length < 1) {
          this.onOutput && this.onOutput([["No sidecar selected"]], ActionOutputStyle.Text)
          return
        }
        const input = actionContext.inputText && actionContext.inputText.trim()
        this.onOutput && this.onOutput([[
          input ? "Sidecar config for FQDN: " + input : "No FQDN entered"
        ]], ActionOutputStyle.Table)
        if(!input) return

        this.showOutputLoading && this.showOutputLoading(true)
        const fqdns = input.split(",").map(s => s.trim()).filter(s => s.length > 0)

        for(const sidecar of sidecars) {
          const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]
          for(const fqdn of fqdns) {
            const output: ActionOutput = []
            output.push([">Fqdn: " + fqdn + " @ Envoy Sidecar: " + sidecar.pod + "." + sidecar.namespace + " @ Cluster: " + sidecar.cluster])
            if(!cluster.canPodExec) {
              output.push(["Lacking pod command execution privileges"])
            } else {
              const configsByType = await EnvoyFunctions.getEnvoyConfigsForFqdn(fqdn, 
                      sidecar.namespace, sidecar.pod, "istio-proxy", cluster.k8sClient)
              Object.keys(configsByType).forEach(configType => {
                const items = configsByType[configType]
                output.push([">>" + configType])
                items.length === 0 && output.push(["No matching data found"])
                items.length > 0 && items.forEach(item => output.push([">>>"+ item.title], [item]))
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
    }
  ]
}

export default plugin
