/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import EnvoyFunctions from '../k8s/envoyFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import ActionContext from '../actions/actionContext';
import JsonUtil from '../util/jsonUtil';
import { EnvoyConfigType } from '../k8s/envoyFunctions';
import EnvoyPluginHelper from '../k8s/envoyPluginHelper'
import ChoiceManager from '../actions/choiceManager';


export function outputConfig(onStreamOutput, configs: any[], dataField?: string, dataTitleField?: string) {
  const output: ActionOutput = []
  configs.forEach(config => {
    const data = dataField ? JsonUtil.extract(config, dataField) : config
    let dataTitle = dataTitleField && JsonUtil.extract(data, dataTitleField)
    dataTitle && (dataTitle = dataTitle.length > 0 ? dataTitle : undefined)
    if(data instanceof Array) {
      data.forEach(item => {
        const itemTitle = dataTitleField && JsonUtil.extract(item, dataTitleField)
        let title = config.title || ""
        dataTitle && (title += (title.length > 0 ? " > " : "") + dataTitle)
        itemTitle && (title += (title.length > 0 ? " > " : "") + itemTitle)
        output.push([">>"+title])
        output.push([item])
      })
    } else {
      let title = config.title || ""
      dataTitle && (title += (title.length > 0 ? " > " : "") + dataTitle)
      output.push([">>"+title])
      delete config.title
      output.push([data])
    }
  })
  onStreamOutput(output)
}

async function outputEnvoyConfig(action: ActionSpec, actionContext: ActionContext, 
                              envoys: any[], configFn: (...args) => Promise<any[]>,
                              configType: string, dataField?: string, dataTitleField?: string) {
  action.onOutput &&
    action.onOutput([["Envoy " + configType]], ActionOutputStyle.Table)
  action.showOutputLoading && action.showOutputLoading(true)

  for(const envoy of envoys) {
    const cluster = actionContext.getClusters().filter(c => c.name === envoy.cluster)[0]
    if(!cluster.canPodExec) {
      action.onStreamOutput  && action.onStreamOutput([["^^", "Envoy Proxy: " + envoy.title + " @ Cluster: " + envoy.cluster]])
      action.onStreamOutput && action.onStreamOutput([["Lacking pod command execution privileges"]])
      continue
    }
    const configs = await configFn(cluster.k8sClient, envoy.namespace, envoy.pod, "istio-proxy")
    action.onStreamOutput  && action.onStreamOutput([["^^", "Envoy Proxy: " + envoy.title + " @ Cluster: " + envoy.cluster + " ("+configs.length+" items)"]])
    switch(configType) {
      case EnvoyConfigType.Bootstrap:
        outputConfig(action.onStreamOutput, configs)
        break
      case EnvoyConfigType.Clusters:
        EnvoyPluginHelper.outputClusterConfig(action.onStreamOutput, configs)
        break;
      case EnvoyConfigType.Listeners:
        EnvoyPluginHelper.outputListenerConfig(action.onStreamOutput, configs)
        break
      case EnvoyConfigType.Routes:
        EnvoyPluginHelper.outputRouteConfig(action.onStreamOutput, configs)
        break
    }
  }
  action.showOutputLoading && action.showOutputLoading(false)
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Envoy Proxy Recipes",
  order: ActionContextOrder.Istio+3,
  actions: [
    {
      name: "Envoy Bootstrap Config",
      order: 21,
      loadingMessage: "Loading Envoy Proxies...",

      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 1),
      
      async act(actionContext) {
        await outputEnvoyConfig(this, actionContext, 
          ChoiceManager.getSelectedEnvoyProxies(actionContext), 
          EnvoyFunctions.getEnvoyBootstrapConfig, "BootstrapConfig")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Envoy Clusters Config",
      order: 22,
      loadingMessage: "Loading Envoy Proxies...",

      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 2),
      
      async act(actionContext) {
        await outputEnvoyConfig(this, actionContext, 
          ChoiceManager.getSelectedEnvoyProxies(actionContext), 
          EnvoyFunctions.getEnvoyClusters, "ClustersConfig")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Envoy Listeners Config",
      order: 23,
      loadingMessage: "Loading Envoy Proxies...",

      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 2),

      async act(actionContext) {
        await outputEnvoyConfig(this, actionContext, 
          ChoiceManager.getSelectedEnvoyProxies(actionContext), 
          EnvoyFunctions.getEnvoyListeners, "ListenersConfig")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Envoy Routes Config",
      order: 24,
      loadingMessage: "Loading Envoy Proxies...",

      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 2),
      
      async act(actionContext) {
        await outputEnvoyConfig(this, actionContext, 
          ChoiceManager.getSelectedEnvoyProxies(actionContext), 
          EnvoyFunctions.getEnvoyRoutes, "RoutesConfig")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Envoy Stats",
      order: 25,
      autoRefreshDelay: 30,
      loadingMessage: "Loading Envoy Proxies...",

      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 2),
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Envoy Proxy Stats"]], ActionOutputStyle.Mono)
        this.showOutputLoading && this.showOutputLoading(true)
        const envoys = ChoiceManager.getSelectedEnvoyProxies(actionContext)
        for(const envoy of envoys) {
          this.onStreamOutput  && this.onStreamOutput([[">Envoy Proxy: " + envoy.title]])
          const cluster = actionContext.getClusters().filter(c => c.name === envoy.cluster)[0]
          if(!cluster.canPodExec) {
            this.onStreamOutput && this.onStreamOutput([["Lacking pod command execution privileges"]])
            continue
          }
          const stats = await EnvoyFunctions.getEnvoyStats(cluster.k8sClient, envoy.namespace, envoy.pod, "istio-proxy")
          this.onStreamOutput && this.onStreamOutput(stats.split("\n").map(line => [line]))
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Envoy ServerInfo",
      order: 26,
      autoRefreshDelay: 30,
      loadingMessage: "Loading Envoy Proxies...",

      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 1, 2),
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Envoy Proxy ServerInfo"]], ActionOutputStyle.Mono)
        this.showOutputLoading && this.showOutputLoading(true)
        const envoys = ChoiceManager.getSelectedEnvoyProxies(actionContext)
        for(const envoy of envoys) {
          this.onStreamOutput  && this.onStreamOutput([[">Envoy Proxy: " + envoy.title]])
          const cluster = actionContext.getClusters().filter(c => c.name === envoy.cluster)[0]
          if(!cluster.canPodExec) {
            this.onStreamOutput && this.onStreamOutput([["Lacking pod command execution privileges"]])
            continue
          }
          const serverInfo = await EnvoyFunctions.getEnvoyServerInfo(cluster.k8sClient, envoy.namespace, envoy.pod, "istio-proxy")
          this.onStreamOutput && this.onStreamOutput([serverInfo])
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
