/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import EnvoyFunctions, {EnvoyConfigType} from '../k8s/envoyFunctions'
import IstioFunctions from '../k8s/istioFunctions';
import IstioPluginHelper from '../k8s/istioPluginHelper'
import JsonUtil from '../util/jsonUtil';
import {compareEnvoyConfigs} from './envoyConfigComparison'
import ChoiceManager from '../actions/choiceManager';


const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Pilot Recipes",
  order: ActionContextOrder.Istio+2,

  actions: [
    {
      name: "Compare Pilot-Envoy Config",
      order: 60,
      loadingMessage: "Loading Envoy Proxies...",
      
      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 1),

      async act(actionContext) {
        const envoys = ChoiceManager.getSelectedEnvoyProxies(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)
        const envoy = envoys[0]
        const cluster = actionContext.getClusters().filter(c => c.name === envoy.cluster)[0]

        this.onOutput && this.onOutput([[
          "", "Pilot [" + envoy.pilotPod + "] <-> Envoy Proxy ["+ envoy.title + "] Config Comparison", ""
        ]], ActionOutputStyle.Mono)

        this.sleep && await this.sleep(200)
        const pilotConfigs = await IstioFunctions.getPilotConfigDump(cluster.k8sClient, envoy.pilotPod, envoy.title)
        const pilotClusters = await EnvoyFunctions.prepareEnvoyClustersConfig(EnvoyFunctions.extractEnvoyConfigForType(pilotConfigs, EnvoyConfigType.Clusters))

        this.sleep && await this.sleep(200)
        const pilotListeners = EnvoyFunctions.prepareEnvoyListenersConfig(EnvoyFunctions.extractEnvoyConfigForType(pilotConfigs, EnvoyConfigType.Listeners))
        const envoyListeners = await EnvoyFunctions.getEnvoyListeners(cluster.k8sClient, envoy.namespace, envoy.pod, "istio-proxy")
        const activeListeners = envoyListeners.filter(l => l.title.includes("active"))
        compareEnvoyConfigs(this.onStreamOutput, pilotListeners, activeListeners, EnvoyConfigType.Listeners, true)
        const warmingListeners = envoyListeners.filter(l => l.title.includes("warming"))
        const drainingListeners = envoyListeners.filter(l => l.title.includes("draining"))
        warmingListeners.length > 0 && this.onStreamOutput && this.onStreamOutput([[">>Skipped Warming Listeners"], [warmingListeners]])
        drainingListeners.length > 0 && this.onStreamOutput && this.onStreamOutput([[">>Skipped Draining Listeners"], [drainingListeners]])

        this.sleep && await this.sleep(200)
        const pilotRoutes = EnvoyFunctions.prepareEnvoyRoutesConfig(EnvoyFunctions.extractEnvoyConfigForType(pilotConfigs, EnvoyConfigType.Routes))
        const envoyRoutes = await EnvoyFunctions.getEnvoyRoutes(cluster.k8sClient, envoy.namespace, envoy.pod, "istio-proxy")
        const dynamicRoutes = envoyRoutes.filter(r => r.title.includes("dynamic"))
        compareEnvoyConfigs(this.onStreamOutput, pilotRoutes, dynamicRoutes, EnvoyConfigType.Routes, true)
        const staticRoutes = envoyRoutes.filter(r => r.title.includes("static"))
        staticRoutes.length > 0 &&  this.onStreamOutput && this.onStreamOutput([[">>Skipped Static Routes"], [staticRoutes]])

        this.sleep && await this.sleep(200)
        let envoyClusters = await EnvoyFunctions.getEnvoyClusters(cluster.k8sClient, envoy.namespace, envoy.pod, "istio-proxy")
        const dynamicClusters = envoyClusters.filter(c => !c.title.includes("static"))
        compareEnvoyConfigs(this.onStreamOutput, pilotClusters, dynamicClusters, EnvoyConfigType.Clusters, true)
        const staticClusters = envoyClusters.filter(c => c.title.includes("static"))
        staticClusters.length > 0 && this.onStreamOutput && this.onStreamOutput([[">>Skipped Static Clusters"], [staticClusters]])

        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
    },
    {
      name: "Compare Pilot-Envoy Listeners Config",
      order: 61,
      loadingMessage: "Loading Envoy Proxies...",
      
      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 1),

      async act(actionContext) {
        const envoys = ChoiceManager.getSelectedEnvoyProxies(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)
        const envoy = envoys[0]
        const cluster = actionContext.getClusters().filter(c => c.name === envoy.cluster)[0]

        this.onOutput && this.onOutput([[
          "Pilot [" + envoy.pilotPod + "] <-> Envoy Proxy ["+ envoy.title + "] Listeners Config Comparison"
        ]], ActionOutputStyle.Mono)

        const pilotListeners = await IstioFunctions.getPilotConfigDump(cluster.k8sClient, envoy.pilotPod, envoy.title, EnvoyConfigType.Listeners)
        this.sleep && await this.sleep(500)
        const envoyListeners = await EnvoyFunctions.getEnvoyListeners(cluster.k8sClient, envoy.namespace, envoy.pod, "istio-proxy")

        const output: ActionOutput = []
        output.push([">Listener Counts"])
        output.push(["Pilot: "+envoy.pilotPod + " = "  + pilotListeners.length])
        output.push(["Envoy: "+envoy.title + " = "  + envoyListeners.length])

        const allListeners: Set<string> = new Set
        const pilotListenerMap: Map<string, any> = new Map
        const envoyListenerMap: Map<string, any> = new Map

        pilotListeners.forEach(l => {
          const title = l.listener.name || l.listener.address.socketAddress.address+":"+l.listener.address.socketAddress.portValue
          allListeners.add(title)
          pilotListenerMap.set(title, l)
        })
        envoyListeners.forEach(l => {
          const title = l.listener.name || l.listener.address.socket_address.address+":"+l.listener.address.socket_address.port_value
          allListeners.add(title)
          envoyListenerMap.set(title, l)
        })

        allListeners.forEach(title => {
          output.push([">Listener: "+title])
          const pilotListener = pilotListenerMap.get(title)
          let pilotFilterChains = pilotListener ? pilotListener.listener.filterChains : undefined

          const envoyListener = envoyListenerMap.get(title)
          let envoyFilterChains = envoyListener ? envoyListener.listener.filter_chains : undefined

          output.push(["Pilot: " + (pilotFilterChains ? pilotFilterChains.length + " filter chains" : "N/A")])
          output.push(["Envoy: " + (envoyFilterChains ? envoyFilterChains.length + " filter chains" : "N/A")])
          
          if(pilotFilterChains && envoyFilterChains) {
            pilotFilterChains = pilotFilterChains.map(fc => JsonUtil.transformObject(fc))
            envoyFilterChains = envoyFilterChains.map(fc => JsonUtil.transformObject(fc))
            const mismatchedPilotFilterChains: any[] = []
            const mismatchedEnvoyFilterChains: any[] = []
            pilotFilterChains.forEach(pfc => {
              const sfc = envoyFilterChains.filter(sfc => JsonUtil.compareObjects(pfc, sfc, []))[0]
              if(pfc && !sfc) {
                mismatchedPilotFilterChains.push(pfc)
              }
            })
            envoyFilterChains.forEach(sfc => {
              const pfc = pilotFilterChains.filter(pfc => JsonUtil.compareObjects(sfc, pfc, []))[0]
              if(sfc && !pfc) {
                mismatchedEnvoyFilterChains.push(sfc)
              }
            })
            if(mismatchedPilotFilterChains.length > 0) {
              output.push([">>Pilot filter chains not present in Envoy"])
              output.push([mismatchedPilotFilterChains])
            }
            if(mismatchedEnvoyFilterChains.length > 0) {
              output.push([">>Envoy filter chains not present in Pilot"])
              output.push([mismatchedEnvoyFilterChains])
            }
            mismatchedPilotFilterChains.length === 0 && mismatchedEnvoyFilterChains.length === 0
              && output.push(["No Mismatched FilterChains"])
          } else if (pilotListener && !envoyListener) {
            output.push([">>Pilot Listener not found in Envoy: "])
            output.push([pilotListener])
          } else if (!pilotListener && envoyListener) {
            output.push([">>Envoy Listener not found in Pilot: "])
            output.push([envoyListener])
          } else {
          }
        })

        this.onStreamOutput && this.onStreamOutput(output)
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
    },
  ]
}

export default plugin
