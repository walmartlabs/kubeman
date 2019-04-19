import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import EnvoyFunctions, {EnvoyConfigType} from '../k8s/envoyFunctions'
import IstioFunctions from '../k8s/istioFunctions';
import IstioPluginHelper from '../k8s/istioPluginHelper'
import JsonUtil from '../util/jsonUtil';
import {outputConfig} from './envoySidecarConfigDump'
import {compareEnvoyConfigs} from './envoySidecarConfigComparison'


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

async function outputSidecarConfig(action, actionContext, configType, titleField: string, 
                                    dataField?: string, dataTitleField?: string) {
  const sidecar = IstioPluginHelper.getSelectedSidecars(actionContext)[0]
  action.showOutputLoading && action.showOutputLoading(true)
  const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]
  action.onOutput && action.onOutput([["Sidecar Config from Pilot"]], ActionOutputStyle.Log)

  const pilotConfigs = await IstioFunctions.getPilotConfigDump(cluster.k8sClient, sidecar.title)
  action.onStreamOutput && action.onStreamOutput([[">" + configType + " for " + sidecar.title]])
  const configs = getConfigItems(pilotConfigs, configType, titleField)
  outputConfig(action.onStreamOutput, configs, dataField, dataTitleField)
  action.showOutputLoading && action.showOutputLoading(false)
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Pilot Recipes",
  order: ActionContextOrder.Istio+2,
  loadingMessage: "Loading Envoy Sidecars...",

  actions: [
    {
      name: "View Sidecar Clusters Config from Pilot",
      order: 50,
      loadingMessage: "Loading Envoy Sidecars...",
      
      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),

      async act(actionContext) {
        outputSidecarConfig(this, actionContext, "ClustersConfigDump", "cluster.name")
      },
    },
    {
      name: "View Sidecar Listeners Config from Pilot",
      order: 50,
      loadingMessage: "Loading Envoy Sidecars...",
      
      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),

      async act(actionContext) {
        outputSidecarConfig(this, actionContext, "ListenersConfigDump", "listener.address.socketAddress.portValue")
      },
    },
    {
      name: "View Sidecar Routes Config from Pilot",
      order: 50,
      loadingMessage: "Loading Envoy Sidecars...",
      
      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),

      async act(actionContext) {
        outputSidecarConfig(this, actionContext, "RoutesConfigDump", 
                            "routeConfig.name", "routeConfig.virtualHosts", "name")
      },
    },
    {
      name: "Compare Pilot-Sidecar Config",
      order: 50,
      loadingMessage: "Loading Envoy Sidecars...",
      
      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),

      async act(actionContext) {
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)
        const sidecar = sidecars[0]
        const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]

        this.onOutput && this.onOutput([[
          "", "Pilot <-> Sidecar Config Comparison", ""
        ]], ActionOutputStyle.Log)

        const pilotConfigs = await IstioFunctions.getPilotConfigDump(cluster.k8sClient, sidecar.title)
        const sidecarConfigs = await EnvoyFunctions.getEnvoyConfigDump(cluster.k8sClient, sidecar.namespace, sidecar.pod, "istio-proxy")

        compareEnvoyConfigs(this.onStreamOutput, pilotConfigs, sidecarConfigs, EnvoyConfigType.Clusters, true, "cluster")

        compareEnvoyConfigs(this.onStreamOutput, pilotConfigs, sidecarConfigs, EnvoyConfigType.Listeners, true, "listener")

        compareEnvoyConfigs(this.onStreamOutput, pilotConfigs, sidecarConfigs, EnvoyConfigType.Routes, true, "routeConfig", "route_config")

        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
    {
      name: "View Pilot-Sidecars Sync Status",
      order: 51,
      autoRefreshDelay: 15,
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Pilot-Sidecars Sync Status"]], ActionOutputStyle.Log)
        this.showOutputLoading && this.showOutputLoading(true)
        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          const output: ActionOutput = []
          output.push([">Cluster: " + cluster.name])
          if(cluster.hasIstio) {
            const result = await IstioFunctions.getPilotSidecarSyncStatus(cluster.k8sClient)
            result.forEach(r => output.push([r], []))
          } else {
            output.push(["Istio not installed"])
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
