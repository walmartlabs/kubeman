import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import ActionContext from '../actions/actionContext';
import IstioFunctions from '../k8s/istioFunctions';
import {outputConfig} from './envoySidecarConfigDump'

async function outputIngresEnvoyConfig(action: ActionSpec, actionContext: ActionContext, configFn: (K8sClient) => Promise<any[]>,
                            configType: string, dataField?: string, dataTitleField?: string) {
  action.onOutput &&
    action.onOutput([["Istio IngressGateway Envoy " + configType]], ActionOutputStyle.Table)
  action.showOutputLoading && action.showOutputLoading(true)

  const clusters = actionContext.getClusters()
  for(const cluster of clusters) {
    action.onStreamOutput  && action.onStreamOutput([[">Cluster: " + cluster.name]])
    if(!cluster.hasIstio) {
      action.onStreamOutput  && action.onStreamOutput([["Istio not installed"]])
      continue
    }
    const configs = await configFn(cluster.k8sClient)
    outputConfig(action.onStreamOutput, configs, dataField, dataTitleField)
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
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["IngressGateway Envoy Stats"]], ActionOutputStyle.Log)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["Istio not installed"]])
            continue
          }
          const ingressEnvoyStats = await IstioFunctions.getIngressGatwayEnvoyStats(cluster.k8sClient)
          const output: ActionOutput = []
          Object.keys(ingressEnvoyStats).forEach(name => output.push(
            [">>Pod: "+name], 
            ...(ingressEnvoyStats[name].split("\n").map(line => [line]))
          ))
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
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["IngressGateway Envoy ServerInfo"]], ActionOutputStyle.Log)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["Istio not installed"]])
            continue
          }
          const ingressEnvoyServerInfos = await IstioFunctions.getIngressGatwayEnvoyServerInfo(cluster.k8sClient)
          const output: ActionOutput = []
          Object.keys(ingressEnvoyServerInfos).forEach(name => output.push([">>Pod: "+name], [ingressEnvoyServerInfos[name]]))
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
