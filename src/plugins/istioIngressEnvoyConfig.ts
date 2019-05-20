import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import ActionContext from '../actions/actionContext';
import IstioFunctions from '../k8s/istioFunctions';
import {outputConfig} from './envoyConfigDump'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import ChoiceManager from '../actions/choiceManager'
import EnvoyPluginHelper from '../k8s/envoyPluginHelper'
import { EnvoyConfigType } from '../k8s/envoyFunctions';

async function outputIngresEnvoyConfig(action: ActionSpec, actionContext: ActionContext, configFn: (K8sClient, podName) => Promise<any[]>, configType: string) {
  action.onOutput && action.onOutput([["Istio IngressGateway Envoy " + configType]], ActionOutputStyle.Table)
  action.showOutputLoading && action.showOutputLoading(true)

  const selections = await ChoiceManager.getPodSelections(actionContext, false)
  for(const selection of selections) {
    action.onStreamOutput  && action.onStreamOutput([["^^","IngressGateway Pod: " + selection.podName + " @ Cluster: " + selection.cluster]])
    const configs = await configFn(selection.k8sClient, selection.podName)
    switch(configType) {
      case EnvoyConfigType.Bootstrap:
      case EnvoyConfigType.Clusters:
      case EnvoyConfigType.Routes:
        outputConfig(action.onStreamOutput, configs)
        break
      case EnvoyConfigType.Listeners:
        EnvoyPluginHelper.outputListenerConfig(action.onStreamOutput, configs)
        break
    }
  }
  action.showOutputLoading && action.showOutputLoading(false)
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "IngressGateway Envoy Bootstrap",
      order: 25,
      loadingMessage: "Loading IngressGateway Pods...",

      choose: IstioPluginHelper.chooseIngressGatewayPods.bind(IstioPluginHelper, 1, 2),
      
      async act(actionContext) {
        await outputIngresEnvoyConfig(this, actionContext, IstioFunctions.getIngressGatewayEnvoyBootstrapConfig,  "BootstrapConfig")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "IngressGateway Envoy Clusters",
      order: 26,
      loadingMessage: "Loading IngressGateway Pods...",

      choose: IstioPluginHelper.chooseIngressGatewayPods.bind(IstioPluginHelper, 1, 2),
      
      async act(actionContext) {
        await outputIngresEnvoyConfig(this, actionContext, IstioFunctions.getIngressGatewayEnvoyClusters, "ClustersConfig")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "IngressGateway Envoy Listeners",
      order: 27,
      loadingMessage: "Loading IngressGateway Pods...",

      choose: IstioPluginHelper.chooseIngressGatewayPods.bind(IstioPluginHelper, 1, 2),
      
      async act(actionContext) {
        await outputIngresEnvoyConfig(this, actionContext, IstioFunctions.getIngressGatewayEnvoyListeners, "ListenersConfig")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "IngressGateway Envoy Routes",
      order: 28,
      loadingMessage: "Loading IngressGateway Pods...",

      choose: IstioPluginHelper.chooseIngressGatewayPods.bind(IstioPluginHelper, 1, 2),
      
      async act(actionContext) {
        await outputIngresEnvoyConfig(this, actionContext, IstioFunctions.getIngressGatewayEnvoyRoutes, "RoutesConfig")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "IngressGateway Envoy Stats",
      order: 29,
      autoRefreshDelay: 60,
      loadingMessage: "Loading IngressGateway Pods...",

      choose: IstioPluginHelper.chooseIngressGatewayPods.bind(IstioPluginHelper, 1, 5),

      async act(actionContext) {
        this.onOutput && this.onOutput([["IngressGateway Envoy Stats"]], ActionOutputStyle.Log)
        this.showOutputLoading && this.showOutputLoading(true)

        const selections = await ChoiceManager.getPodSelections(actionContext, false)
        for(const selection of selections) {
          this.onStreamOutput  && this.onStreamOutput([[">IngressGateway Pod: " + selection.podName + " @ Cluster: " + selection.cluster]])
          const ingressEnvoyStats = await IstioFunctions.getIngressGatwayEnvoyStats(selection.podName, selection.k8sClient)
          const output: ActionOutput = []
          output.push(...(ingressEnvoyStats.split("\n").map(line => [line])))
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
    },
    {
      name: "IngressGateway Envoy ServerInfo",
      order: 30,
      autoRefreshDelay: 60,
      loadingMessage: "Loading IngressGateway Pods...",

      choose: IstioPluginHelper.chooseIngressGatewayPods.bind(IstioPluginHelper, 1, 5),

      async act(actionContext) {
        this.onOutput && this.onOutput([["IngressGateway Envoy ServerInfo"]], ActionOutputStyle.Log)
        this.showOutputLoading && this.showOutputLoading(true)

        const selections = await ChoiceManager.getPodSelections(actionContext, false)
        for(const selection of selections) {
          this.onStreamOutput  && this.onStreamOutput([[">IngressGateway Pod: " + selection.podName + " @ Cluster: " + selection.cluster]])
          const ingressEnvoyServerInfos = await IstioFunctions.getIngressGatwayEnvoyServerInfo(selection.podName, selection.k8sClient)
          const output: ActionOutput = []
          Object.keys(ingressEnvoyServerInfos).forEach(name => output.push([ingressEnvoyServerInfos[name]]))
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
