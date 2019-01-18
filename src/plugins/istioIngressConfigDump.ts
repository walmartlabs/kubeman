import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import ActionContext from '../actions/actionContext';
import JsonUtil from '../util/jsonUtil';
import IstioFunctions from '../k8s/istioFunctions';

async function outputConfig(action: ActionSpec, actionContext: ActionContext, type: string, 
                            titleField: string, dataField?: string) {
  action.onOutput &&
    action.onOutput([["", "Istio IngressGateway " + type]], ActionOutputStyle.Table)
  action.showOutputLoading && action.showOutputLoading(true)

  const clusters = actionContext.getClusters()
  for(const cluster of clusters) {
    action.onStreamOutput  && action.onStreamOutput([[">Cluster: " + cluster.name, ""]])
    if(!cluster.hasIstio) {
      action.onStreamOutput  && action.onStreamOutput([["", "Istio not installed"]])
      continue
    }
    const output: ActionOutput = []
    const k8sClient = cluster.k8sClient

    const configs = await IstioFunctions.getIngressConfigDump(k8sClient, type)
    configs.forEach(c => {
      output.push([">>"+JsonUtil.extract(c, titleField)])
      let data = dataField ? JsonUtil.extract(c, dataField) : c
      if(data instanceof Array) {
        data.forEach(item => output.push([item]))
      } else {
        output.push([data])
      }
    })
    action.onStreamOutput  && action.onStreamOutput(output)
  }
  action.showOutputLoading && action.showOutputLoading(false)
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "View Ingress Clusters Config",
      order: 25,
      
      async act(actionContext) {
        await outputConfig(this, actionContext, "ClustersConfigDump", "cluster.name")
      },
    },
    {
      name: "View Ingress Listeners",
      order: 26,
      
      async act(actionContext) {
        await outputConfig(this, actionContext, "ListenersConfigDump", "listener.name")
      },
    },
    {
      name: "View Ingress Routes Config",
      order: 27,
      
      async act(actionContext) {
        await outputConfig(this, actionContext, "RoutesConfigDump", "route_config.name", "route_config.virtual_hosts")
      },
    }
  ]
}

export default plugin
