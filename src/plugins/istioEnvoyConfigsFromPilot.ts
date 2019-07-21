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
import {outputConfig} from './envoyConfigDump'
import ChoiceManager from '../actions/choiceManager'


function getConfigItems(configs, configType, titleField) {
  configs = configs.filter(c => c["@type"].includes(configType))[0]
  if(configs) {
    const dynamicItems = configs[Object.keys(configs).filter(key => key.includes("dynamic"))[0]]
    const staticItems = configs[Object.keys(configs).filter(key => key.includes("static"))[0]]
    const items: any[] = []
    staticItems && staticItems.forEach(item => item && items.push(item))
    dynamicItems && dynamicItems.forEach(item => item && items.push(item))
    items.forEach(item => item.title = JsonUtil.extract(item, titleField))
    return items
  } else {
    return []
  }
}

async function outputEnvoyConfig(action, actionContext, configType, titleField: string, 
                                    dataField?: string, dataTitleField?: string) {
  const envoy = ChoiceManager.getSelectedEnvoyProxies(actionContext)[0]
  const title = configType.replace("Dump", "")
  action.showOutputLoading && action.showOutputLoading(true)
  const cluster = actionContext.getClusters().filter(c => c.name === envoy.cluster)[0]
  action.onOutput && action.onOutput([["Envoy " + title + " from Pilot"]], ActionOutputStyle.Mono)

  if(!cluster.canPodExec) {
    action.onStreamOutput && action.onStreamOutput([["Lacking pod command execution privileges"]])
  } else {
    const pilotConfigs = await IstioFunctions.getPilotConfigDump(cluster.k8sClient, envoy.pilotPod, envoy.title)
    action.onStreamOutput && action.onStreamOutput([[">" + title + " for " + envoy.title]])
    const configs = getConfigItems(pilotConfigs, configType, titleField)
    outputConfig(action.onStreamOutput, configs, dataField, dataTitleField)
  }
  action.showOutputLoading && action.showOutputLoading(false)
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Pilot Recipes",
  order: ActionContextOrder.Istio+2,

  actions: [
    {
      name: "View Envoy Clusters Config from Pilot",
      order: 50,
      loadingMessage: "Loading Envoy Proxies...",
      
      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 1),

      async act(actionContext) {
        outputEnvoyConfig(this, actionContext, "ClustersConfigDump", "cluster.name")
      },
    },
    {
      name: "View Envoy Listeners Config from Pilot",
      order: 51,
      loadingMessage: "Loading Envoy Proxies...",
      
      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 1),

      async act(actionContext) {
        outputEnvoyConfig(this, actionContext, "ListenersConfigDump", "listener.address.socketAddress.portValue")
      },
    },
    {
      name: "View Envoy Routes Config from Pilot",
      order: 52,
      loadingMessage: "Loading Envoy Proxies...",
      
      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 1),

      async act(actionContext) {
        outputEnvoyConfig(this, actionContext, "RoutesConfigDump", 
                            "routeConfig.name", "routeConfig.virtualHosts", "name")
      },
    },
    {
      name: "View Pilot-Envoy Sync Status",
      order: 53,
      autoRefreshDelay: 15,
      loadingMessage: "Loading Pilot Pods...",
            
      choose: ChoiceManager.choosePilotPods.bind(ChoiceManager, 1, 3),

      async act(actionContext) {
        this.onOutput && this.onOutput([["Pilot-Sidecars Sync Status"]], ActionOutputStyle.Mono)
        this.showOutputLoading && this.showOutputLoading(true)

        const selections = await ChoiceManager.getPodSelections(actionContext, false)
        for(const selection of selections) {
          const output: ActionOutput = []
          output.push([">Pilot Pod: " + selection.podName + " @ Cluster: " + selection.cluster])
          if(!selection.k8sClient.canPodExec) {
            output.push(["Lacking pod command execution privileges"])
          } else {
            const result = await IstioFunctions.getPilotSidecarSyncStatus(selection.k8sClient, selection.podName)
            result.forEach(r => output.push([r], []))
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },

      refresh(actionContext) {
        this.act(actionContext)
      },
    }
  ]
}

export default plugin
