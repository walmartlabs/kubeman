import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions';
import IstioPluginHelper from '../k8s/istioPluginHelper'
import JsonUtil from '../util/jsonUtil';

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

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Pilot Recipes",
  order: ActionContextOrder[ActionContextType.Istio]+2,
  actions: [
    {
      name: "Compare Pilot-Sidecar Config",
      order: 43,
      
      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),

      async act(actionContext) {

        this.showOutputLoading && this.showOutputLoading(true)
        const sidecar = IstioPluginHelper.getSelectedSidecars(actionContext)[0]
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
    }
  ]
}

export default plugin
