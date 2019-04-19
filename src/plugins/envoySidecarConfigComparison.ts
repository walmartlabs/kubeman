import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import EnvoyFunctions, {EnvoyConfigType} from '../k8s/envoyFunctions'
import JsonUtil from '../util/jsonUtil';
import K8sFunctions from '../k8s/k8sFunctions';


export function compareEnvoyConfigs(onStreamOutput, configs1: any[], configs2: any[], type: string, 
                                  transform: boolean, itemKey: string, sidecarItemKey: string = itemKey, 
                                  ignoreKeys?: string[], ignoreValues?: string[]) {
  const output: ActionOutput = []
  const envoyConfig1 = configs1.filter(c => c["@type"].includes(type))[0]
  const envoyConfig2 = configs2.filter(c => c["@type"].includes(type))[0]
  const items = {}
  const diffs = {}
  const matchingRecords: string[] = []

  const normalizeName = (name, index) => ignoreValues && name.startsWith(ignoreValues[index]) ? name.replace(ignoreValues[index], "xxx") : name

  Object.keys(envoyConfig1).forEach(key => {
    if(key.includes("dynamic")) {
      envoyConfig1[key].forEach(c1 => {
        const name = normalizeName(c1[itemKey].name, 0)
        items[name]=[c1[itemKey], "Missing"]
      })
    }
  })

  Object.keys(envoyConfig2).forEach(key => {
    if(key.includes("dynamic")) {
      envoyConfig2[key].forEach(c2 => {
        const name = normalizeName(c2[sidecarItemKey].name, 1)
        if(items[name]) {
          const c1 = items[name][0]
          //delete type field because there's in unnecessary mismatch
          delete c1.type
          delete c2[sidecarItemKey].type
          const config1Item = transform ? JsonUtil.transformObject(c1) : c1
          const config2Item = transform ? JsonUtil.transformObject(c2[sidecarItemKey]) : c2[sidecarItemKey]
          const itemDiffs: string[] = []
          const matches = JsonUtil.compareObjects(config1Item, config2Item, itemDiffs, ignoreKeys, ignoreValues)
          if(matches) {
            matchingRecords.push(c1.name === c2[sidecarItemKey].name ? c1.name : c1.name + " <---> " + c2[sidecarItemKey].name)
            delete items[name]
          } else {
            diffs[name] = itemDiffs
            items[name][1]=c2[sidecarItemKey]
          }
        } else {
          items[name] = ["Missing", c2[sidecarItemKey]]
        }
      })
    }
  })

  output.push([">Matching "+type, ""])
  matchingRecords.length === 0 && output.push([">>No matching "+type, ""])
  matchingRecords.forEach(c => output.push(["<<", c, ""]))

  if(Object.keys(items).length > 0) {
    output.push([">Mismatched "+type, ""])
    Object.keys(items).forEach(item => {
      output.push([">>"+(items[item][0].name || 'N/A'), (items[item][1].name||'N/A')])
      output.push(["<<", items[item][0], items[item][1]])
      const name = items[item][0].name ? normalizeName(items[item][0].name, 0) : normalizeName(items[item][1].name, 1)
      diffs[name] && diffs[name].length > 0 && output.push(["++", "Differing Keys:",""], ["<<", diffs[name]])
    })
  } else {
    output.push([">>No Mismatched "+type, ""])
  }
  onStreamOutput(output)
}


const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Envoy Proxy Recipes",
  order: ActionContextOrder.Istio+3,
  actions: [
    {
      name: "Compare Configs of Envoy Sidecars",
      order: 30,
      loadingMessage: "Loading Envoy Sidecars...",

      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 2, 2),

      async act(actionContext) {
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        const sidecar1 = sidecars[0]
        const sidecar2 = sidecars[1]

        this.onOutput && this.onOutput([["Sidecar Config Comparison for " + 
          sidecar1.pod+"."+sidecar1.namespace+"@"+sidecar1.cluster + " and " +
          sidecar2.pod+"."+sidecar2.namespace+"@"+sidecar2.cluster, 
          ""]], ActionOutputStyle.Log)
        this.showOutputLoading && this.showOutputLoading(true)

        const cluster1 = actionContext.getClusters().filter(c => c.name === sidecar1.cluster)[0]
        const sidecar1Configs = await EnvoyFunctions.getEnvoyConfigDump(cluster1.k8sClient, sidecar1.namespace, sidecar1.pod, "istio-proxy")
        const pod1Details = await K8sFunctions.getPodDetails(sidecar1.namespace, sidecar1.pod, cluster1.k8sClient)
        const pod1IP = pod1Details && pod1Details.podIP

        const cluster2 = actionContext.getClusters().filter(c => c.name === sidecar2.cluster)[0]
        const sidecar2Configs = await EnvoyFunctions.getEnvoyConfigDump(cluster2.k8sClient, sidecar2.namespace, sidecar2.pod, "istio-proxy")
        const pod2Details = await K8sFunctions.getPodDetails(sidecar2.namespace, sidecar2.pod, cluster2.k8sClient)
        const pod2IP = pod2Details && pod2Details.podIP

        const keysToIgnore: string[] = ["mixer_attributes", "uid"]

        const valuesToIgnore: string[] = []
        pod1IP && valuesToIgnore.push(pod1IP)
        pod2IP && valuesToIgnore.push(pod2IP)

        compareEnvoyConfigs(this.onStreamOutput, sidecar1Configs, sidecar2Configs, EnvoyConfigType.Clusters, false, "cluster", "cluster", keysToIgnore, valuesToIgnore)

        compareEnvoyConfigs(this.onStreamOutput, sidecar1Configs, sidecar2Configs, EnvoyConfigType.Listeners, false, "listener", "listener", keysToIgnore, valuesToIgnore)

        compareEnvoyConfigs(this.onStreamOutput, sidecar1Configs, sidecar2Configs, EnvoyConfigType.Routes, false, "route_config", "route_config", keysToIgnore, valuesToIgnore)

        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    }
  ]
}

export default plugin
