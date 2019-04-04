import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions';
import IstioPluginHelper from '../k8s/istioPluginHelper'
import JsonUtil from '../util/jsonUtil';
import {outputConfig} from './istioSidecarConfigDump'

function compareConfigs(onStreamOutput, pilotConfigs: any[], sidecarConfigs: any[], 
                        type: string, itemKey: string, sidecarItemKey: string = itemKey) {
  const output: ActionOutput = []

  const pilotConfig = pilotConfigs.filter(c => c["@type"].includes(type))[0]
  const sidecarConfig = sidecarConfigs.filter(c => c["@type"].includes(type))[0]
  const items = {}
  const matchingRecords: string[] = []
  Object.keys(pilotConfig).forEach(key => {
    if(key.includes("dynamic")) {
      pilotConfig[key].forEach(c => items[c[itemKey].name]=[c[itemKey], "Missing"])
    }
  })

  Object.keys(sidecarConfig).forEach(key => {
    if(key.includes("dynamic")) {
      sidecarConfig[key].forEach(c => {
        if(items[c[sidecarItemKey].name]) {
          const pilotItem = JsonUtil.transformObject(items[c[sidecarItemKey].name][0])
          const sidecarItem = JsonUtil.transformObject(c[sidecarItemKey])
          const matches = JsonUtil.compareObjects(pilotItem, sidecarItem)
          if(matches) {
            matchingRecords.push(c[sidecarItemKey].name)
            delete items[c[sidecarItemKey].name]
          } else {
            items[c[sidecarItemKey].name][1]=c[sidecarItemKey]
          }
        } else {
          items[c[sidecarItemKey].name] = ["Missing", c[sidecarItemKey]]
        }
      })
    }
  })

  output.push([">Matching "+type, "", ""])
  matchingRecords.forEach(c => output.push(["", c, ""]))

  if(Object.keys(items).length > 0) {
    output.push([">>Mismatched "+type, "", ""])
    Object.keys(items).forEach(item => {
      output.push([items[item][0].name, items[item][0], items[item][1]])
    })
  } else {
    output.push([">>No Mismatched "+type, "", ""])
  }
  onStreamOutput(output)
}

function getConfigItems(configs, configType) {
  configs = configs.filter(c => c["@type"].includes(configType))[0]
  const dynamicItems = configs[Object.keys(configs).filter(key => key.includes("dynamic"))[0]]
  const staticItems = configs[Object.keys(configs).filter(key => key.includes("static"))[0]]
  const items: any[] = []
  staticItems && staticItems.forEach(item => item && items.push(item))
  dynamicItems && dynamicItems.forEach(item => item && items.push(item))
  return items
}

async function outputSidecarConfig(action, actionContext, configType, titleField: string, 
                                    dataField?: string, dataTitleField?: string) {
  const sidecar = IstioPluginHelper.getSelectedSidecars(actionContext)[0]
  action.showOutputLoading && action.showOutputLoading(true)
  const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]
  action.onOutput && action.onOutput([["Sidecar Config from Pilot"]], ActionOutputStyle.Log)

  const pilotConfigs = await IstioFunctions.getPilotConfigDump(cluster.k8sClient, sidecar.title)
  action.onStreamOutput && action.onStreamOutput([[">" + configType + " for " + sidecar.title]])
  outputConfig(action.onStreamOutput, getConfigItems(pilotConfigs, configType), 
                      titleField, dataField, dataTitleField)
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
        if(sidecars.length < 1) {
          this.onOutput && this.onOutput([["No sidecar selected"]], ActionOutputStyle.Text)
          return
        }

        this.showOutputLoading && this.showOutputLoading(true)
        const sidecar = sidecars[0]
        const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]

        this.onOutput && this.onOutput([[
          "", "Pilot-Sidecar Config Comparison", ""
        ]], ActionOutputStyle.Log)

        const pilotConfigs = await IstioFunctions.getPilotConfigDump(cluster.k8sClient, sidecar.title)
        const sidecarConfigs = await IstioFunctions.getIstioProxyConfigDump(cluster.k8sClient, sidecar.namespace, sidecar.pod)

        compareConfigs(this.onStreamOutput, pilotConfigs, sidecarConfigs, "ClustersConfigDump", "cluster")

        compareConfigs(this.onStreamOutput, pilotConfigs, sidecarConfigs, "ListenersConfigDump", "listener")

        compareConfigs(this.onStreamOutput, pilotConfigs, sidecarConfigs, "RoutesConfigDump", "routeConfig", "route_config")

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
          this.onStreamOutput && this.onStreamOutput([[">Cluster: " + cluster.name]])
        if(cluster.hasIstio) {
            const result = await IstioFunctions.getPilotSidecarSyncStatus(cluster.k8sClient)
            this.onStreamOutput && this.onStreamOutput([[result]])
          } else {
            this.onStreamOutput && this.onStreamOutput([["Istio not installed"]])
          }
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
