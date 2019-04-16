import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import EnvoyFunctions from '../k8s/envoyFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import ActionContext from '../actions/actionContext';
import JsonUtil from '../util/jsonUtil';


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

async function outputSidecarConfig(action: ActionSpec, actionContext: ActionContext, 
                              sidecars: any[], configFn: (...args) => Promise<any[]>,
                              configType: string, dataField?: string, dataTitleField?: string) {
  action.onOutput &&
    action.onOutput([["Envoy " + configType]], ActionOutputStyle.Table)
  action.showOutputLoading && action.showOutputLoading(true)

  for(const sidecar of sidecars) {
    action.onStreamOutput  && action.onStreamOutput([[">Envoy Sidecar: " + sidecar.title]])
    const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]
    const configs = await configFn(cluster.k8sClient, sidecar.namespace, sidecar.pod, "istio-proxy")
    outputConfig(action.onStreamOutput, configs, dataField, dataTitleField)
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
      loadingMessage: "Loading Envoy Sidecars...",

      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),
      
      async act(actionContext) {
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        if(sidecars.length < 1) {
          this.onOutput && this.onOutput([["No sidecar selected"]], ActionOutputStyle.Text)
          return
        }
        await outputSidecarConfig(this, actionContext, sidecars, EnvoyFunctions.getEnvoyBootstrapConfig, "BootstrapConfig")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Envoy Clusters Config",
      order: 22,
      loadingMessage: "Loading Envoy Sidecars...",

      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),
      
      async act(actionContext) {
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        if(sidecars.length < 1) {
          this.onOutput && this.onOutput([["No sidecar selected"]], ActionOutputStyle.Text)
          return
        }
        await outputSidecarConfig(this, actionContext, sidecars, EnvoyFunctions.getEnvoyClusters, "ClustersConfig")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Envoy Listeners Config",
      order: 23,
      loadingMessage: "Loading Envoy Sidecars...",

      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),
      
      async act(actionContext) {
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        if(sidecars.length < 1) {
          this.onOutput && this.onOutput([["No sidecar selected"]], ActionOutputStyle.Text)
          return
        }
        await outputSidecarConfig(this, actionContext, sidecars, EnvoyFunctions.gettEnvoyListeners, "ListenersConfig")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Envoy Routes Config",
      order: 24,
      loadingMessage: "Loading Envoy Sidecars...",

      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),
      
      async act(actionContext) {
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        if(sidecars.length < 1) {
          this.onOutput && this.onOutput([["No sidecar selected"]], ActionOutputStyle.Text)
          return
        }
        await outputSidecarConfig(this, actionContext, sidecars, EnvoyFunctions.gettEnvoyRoutes, "RoutesConfig")
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Envoy Stats",
      order: 25,
      autoRefreshDelay: 30,
      loadingMessage: "Loading Envoy Sidecars...",

      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Envoy Sidecar Stats"]], ActionOutputStyle.Log)
        this.showOutputLoading && this.showOutputLoading(true)
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        for(const sidecar of sidecars) {
          this.onStreamOutput  && this.onStreamOutput([[">Sidecar: " + sidecar.title]])
          const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]
          const stats = await EnvoyFunctions.getEnvoyStats(cluster.k8sClient, sidecar.namespace, sidecar.pod, "istio-proxy")
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
      loadingMessage: "Loading Envoy Sidecars...",

      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 5),
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Envoy Sidecar ServerInfo"]], ActionOutputStyle.Log)
        this.showOutputLoading && this.showOutputLoading(true)
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        for(const sidecar of sidecars) {
          this.onStreamOutput  && this.onStreamOutput([[">Sidecar: " + sidecar.title]])
          const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]
          const serverInfo = await EnvoyFunctions.getEnvoyServerInfo(cluster.k8sClient, sidecar.namespace, sidecar.pod, "istio-proxy")
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
