import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import ActionContext from '../actions/actionContext';
import JsonUtil from '../util/jsonUtil';
import IstioFunctions from '../k8s/istioFunctions';


export function outputConfig(onStreamOutput, configs: any[], titleField: string, 
                              dataField?: string, dataTitleField?: string) {
  const output: ActionOutput = []
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
  onStreamOutput(output)
}

async function outputSidecarConfig(action: ActionSpec, actionContext: ActionContext, 
                              sidecars: any[], type: string, titleField: string, 
                              dataField?: string, dataTitleField?: string) {
  action.onOutput &&
    action.onOutput([["", "Sidecar " + type]], ActionOutputStyle.Table)
  action.showOutputLoading && action.showOutputLoading(true)

  for(const sidecar of sidecars) {
    action.onStreamOutput  && action.onStreamOutput([[">Sidecar: " + sidecar.title, ""]])
    const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]
    const output: ActionOutput = []

    const configs = await IstioFunctions.getIstioProxyConfigDump(cluster.k8sClient, sidecar.namespace, sidecar.pod, type)
    outputConfig(action.onStreamOutput, configs, titleField, dataField, dataTitleField)
  }
  action.showOutputLoading && action.showOutputLoading(false)
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Sidecars Recipes",
  order: ActionContextOrder.Istio+3,
  actions: [
    {
      name: "Sidecar Clusters Config",
      order: 21,
      loadingMessage: "Loading Envoy Sidecars...",

      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),
      
      async act(actionContext) {
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        if(sidecars.length < 1) {
          this.onOutput && this.onOutput([["No sidecar selected"]], ActionOutputStyle.Text)
          return
        }
        await outputSidecarConfig(this, actionContext, sidecars, "ClustersConfigDump", "cluster.name")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Sidecar Listeners Config",
      order: 22,
      loadingMessage: "Loading Envoy Sidecars...",

      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),
      
      async act(actionContext) {
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        if(sidecars.length < 1) {
          this.onOutput && this.onOutput([["No sidecar selected"]], ActionOutputStyle.Text)
          return
        }
        await outputSidecarConfig(this, actionContext, sidecars, "ListenersConfigDump", "listener.address.socket_address.port_value")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Sidecar Routes Config",
      order: 23,
      loadingMessage: "Loading Envoy Sidecars...",

      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),
      
      async act(actionContext) {
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        if(sidecars.length < 1) {
          this.onOutput && this.onOutput([["No sidecar selected"]], ActionOutputStyle.Text)
          return
        }
        await outputSidecarConfig(this, actionContext, sidecars, "RoutesConfigDump", "route_config.name", "route_config.virtual_hosts", "name")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Sidecar Stats",
      order: 30,
      autoRefreshDelay: 30,
      loadingMessage: "Loading Envoy Sidecars...",

      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),
      
      async act(actionContext) {
        this.clear && this.clear(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        for(const sidecar of sidecars) {
          this.onStreamOutput  && this.onStreamOutput([[">Sidecar: " + sidecar.title]])
          const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]
          const stats = await IstioFunctions.getIstioProxyStats(cluster.k8sClient, sidecar.namespace, sidecar.pod)
          this.onStreamOutput && this.onStreamOutput(stats.split("\n").map(line => [line]))
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([["Sidecar Stats"]], ActionOutputStyle.Log)
      }
    }
  ]
}

export default plugin
