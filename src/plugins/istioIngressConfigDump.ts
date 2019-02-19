import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import ActionContext from '../actions/actionContext';
import JsonUtil from '../util/jsonUtil';
import IstioFunctions from '../k8s/istioFunctions';

async function outputConfig(action: ActionSpec, actionContext: ActionContext, type: string, 
                            titleField: string, dataField?: string, dataTitleField?: string) {
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
      const configTitle = JsonUtil.extract(c, titleField)
      const data = dataField ? JsonUtil.extract(c, dataField) : c
      let dataTitle = dataTitleField && JsonUtil.extract(data, dataTitleField)
      dataTitle && (dataTitle = dataTitle.length > 0 ? dataTitle : undefined)
      if(data instanceof Array) {
        data.forEach(item => {
          const itemTitle = dataTitleField && JsonUtil.extract(item, dataTitleField)
          let title = configTitle || ""
          dataTitle && (title += (title.length > 0 ? " > " : "") + dataTitle)
          itemTitle && (title += (title.length > 0 ? " > " : "") + itemTitle)
          output.push([">>"+title])
          output.push([item])
        })
      } else {
        let title = configTitle || ""
        dataTitle && (title += (title.length > 0 ? " > " : "") + dataTitle)
        output.push([">>"+title])
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
      name: "IngressGateway Clusters Config",
      order: 25,
      
      async act(actionContext) {
        await outputConfig(this, actionContext, "ClustersConfigDump", "cluster.name")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "IngressGateway Listeners Config",
      order: 26,
      
      async act(actionContext) {
        await outputConfig(this, actionContext, "ListenersConfigDump", "listener.address.socket_address.port_value")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "IngressGateway Routes Config",
      order: 27,
      
      async act(actionContext) {
        await outputConfig(this, actionContext, "RoutesConfigDump", "route_config.name", 
                                      "route_config.virtual_hosts", "name")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "IngressGateway Stats",
      order: 28,
      autoRefreshDelay: 60,
      
      async act(actionContext) {
        this.clear && this.clear(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name, ""]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["", "Istio not installed"]])
            continue
          }
          const stats = await IstioFunctions.getIngressGatwayStats(cluster.k8sClient)
          this.onStreamOutput && this.onStreamOutput(stats.split("\n").map(line => [line]))
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([["", "IngressGateway Stats"]], ActionOutputStyle.Log)
      },
    }
  ]
}

export default plugin
