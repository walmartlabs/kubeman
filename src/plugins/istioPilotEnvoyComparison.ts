import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import EnvoyFunctions, {EnvoyConfigType} from '../k8s/envoyFunctions'
import IstioFunctions from '../k8s/istioFunctions';
import IstioPluginHelper from '../k8s/istioPluginHelper'
import JsonUtil from '../util/jsonUtil';
import {compareEnvoyConfigs} from './envoySidecarConfigComparison'


const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Pilot Recipes",
  order: ActionContextOrder.Istio+2,

  actions: [
    {
      name: "Compare Pilot-Envoy Config",
      order: 60,
      loadingMessage: "Loading Envoy Proxies...",
      
      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),

      async act(actionContext) {
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)
        const sidecar = sidecars[0]
        const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]

        this.onOutput && this.onOutput([[
          "", "Pilot [" + sidecar.pilotPod + "] <-> Sidecar ["+ sidecar.title + "] Config Comparison", ""
        ]], ActionOutputStyle.Log)

        const pilotConfigs = await IstioFunctions.getPilotConfigDump(cluster.k8sClient, sidecar.pilotPod, sidecar.title)
        const pilotClusters = await EnvoyFunctions.prepareEnvoyClustersConfig(EnvoyFunctions.extractEnvoyConfigForType(pilotConfigs, EnvoyConfigType.Clusters))
        const pilotListeners = EnvoyFunctions.prepareEnvoyListenersConfig(EnvoyFunctions.extractEnvoyConfigForType(pilotConfigs, EnvoyConfigType.Listeners))
        const pilotRoutes = EnvoyFunctions.prepareEnvoyRoutesConfig(EnvoyFunctions.extractEnvoyConfigForType(pilotConfigs, EnvoyConfigType.Routes))
        
        let envoyClusters = await EnvoyFunctions.getEnvoyClusters(cluster.k8sClient, sidecar.namespace, sidecar.pod, "istio-proxy")
        const staticClusters = envoyClusters.filter(c => c.title.includes("static"))
        const dynamicClusters = envoyClusters.filter(c => !c.title.includes("static"))

        const envoyListeners = await EnvoyFunctions.getEnvoyListeners(cluster.k8sClient, sidecar.namespace, sidecar.pod, "istio-proxy")
        const activeListeners = envoyListeners.filter(l => l.title.includes("active"))
        const warmingListeners = envoyListeners.filter(l => l.title.includes("warming"))
        const drainingListeners = envoyListeners.filter(l => l.title.includes("draining"))

        const envoyRoutes = await EnvoyFunctions.getEnvoyRoutes(cluster.k8sClient, sidecar.namespace, sidecar.pod, "istio-proxy")
        const dynamicRoutes = envoyRoutes.filter(r => r.title.includes("dynamic"))
        const staticRoutes = envoyRoutes.filter(r => r.title.includes("static"))

        compareEnvoyConfigs(this.onStreamOutput, pilotClusters, dynamicClusters, EnvoyConfigType.Clusters, true)
        staticClusters.length > 0 && this.onStreamOutput && this.onStreamOutput([[">>Skipped Static Clusters"], [staticClusters]])

        compareEnvoyConfigs(this.onStreamOutput, pilotListeners, activeListeners, EnvoyConfigType.Listeners, true)
        warmingListeners.length > 0 && this.onStreamOutput && this.onStreamOutput([[">>Skipped Warming Listeners"], [warmingListeners]])
        drainingListeners.length > 0 && this.onStreamOutput && this.onStreamOutput([[">>Skipped Draining Listeners"], [drainingListeners]])

        compareEnvoyConfigs(this.onStreamOutput, pilotRoutes, dynamicRoutes, EnvoyConfigType.Routes, true)
        staticRoutes.length > 0 &&  this.onStreamOutput && this.onStreamOutput([[">>Skipped Static Routes"], [staticRoutes]])

        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
    },
    {
      name: "Compare Pilot-Envoy Listeners Config",
      order: 61,
      loadingMessage: "Loading Envoy Proxies...",
      
      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 1),

      async act(actionContext) {
        const sidecars = IstioPluginHelper.getSelectedSidecars(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)
        const sidecar = sidecars[0]
        const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]

        this.onOutput && this.onOutput([[
          "Pilot [" + sidecar.pilotPod + "] <-> Sidecar ["+ sidecar.title + "] Listeners Config Comparison"
        ]], ActionOutputStyle.Log)

        const pilotListeners = await IstioFunctions.getPilotConfigDump(cluster.k8sClient, sidecar.pilotPod, sidecar.title, EnvoyConfigType.Listeners)
        const sidecarListeners = await EnvoyFunctions.getEnvoyListeners(cluster.k8sClient, sidecar.namespace, sidecar.pod, "istio-proxy")

        const output: ActionOutput = []
        output.push([">Listener Counts"])
        output.push(["Pilot: "+sidecar.pilotPod + " = "  + pilotListeners.length])
        output.push(["Sidecar: "+sidecar.title + " = "  + sidecarListeners.length])

        const allListeners: Set<string> = new Set
        const pilotListenerMap: Map<string, any> = new Map
        const sidecarListenerMap: Map<string, any> = new Map

        pilotListeners.forEach(l => {
          const title = l.listener.name || l.listener.address.socketAddress.address+":"+l.listener.address.socketAddress.portValue
          allListeners.add(title)
          pilotListenerMap.set(title, l)
        })
        sidecarListeners.forEach(l => {
          const title = l.listener.name || l.listener.address.socket_address.address+":"+l.listener.address.socket_address.port_value
          allListeners.add(title)
          sidecarListenerMap.set(title, l)
        })

        allListeners.forEach(title => {
          output.push([">Listener: "+title])
          const pilotListener = pilotListenerMap.get(title)
          let pilotFilterChains = pilotListener ? pilotListener.listener.filterChains : undefined

          const sidecarListener = sidecarListenerMap.get(title)
          let sidecarFilterChains = sidecarListener ? sidecarListener.listener.filter_chains : undefined

          output.push(["Pilot: " + (pilotFilterChains ? pilotFilterChains.length + " filter chains" : "N/A")])
          output.push(["Sidecar: " + (sidecarFilterChains ? sidecarFilterChains.length + " filter chains" : "N/A")])
          
          if(pilotFilterChains && sidecarFilterChains) {
            pilotFilterChains = pilotFilterChains.map(fc => JsonUtil.transformObject(fc))
            sidecarFilterChains = sidecarFilterChains.map(fc => JsonUtil.transformObject(fc))
            const mismatchedPilotFilterChains: any[] = []
            const mismatchedSidecarFilterChains: any[] = []
            pilotFilterChains.forEach(pfc => {
              const sfc = sidecarFilterChains.filter(sfc => JsonUtil.compareObjects(pfc, sfc, []))[0]
              if(pfc && !sfc) {
                mismatchedPilotFilterChains.push(pfc)
              }
            })
            sidecarFilterChains.forEach(sfc => {
              const pfc = pilotFilterChains.filter(pfc => JsonUtil.compareObjects(sfc, pfc, []))[0]
              if(sfc && !pfc) {
                mismatchedSidecarFilterChains.push(sfc)
              }
            })
            if(mismatchedPilotFilterChains.length > 0) {
              output.push([">>Pilot filter chains not present in Sidecar"])
              output.push([mismatchedPilotFilterChains])
            }
            if(mismatchedSidecarFilterChains.length > 0) {
              output.push([">>Sidecar filter chains not present in Pilot"])
              output.push([mismatchedSidecarFilterChains])
            }
            mismatchedPilotFilterChains.length === 0 && mismatchedSidecarFilterChains.length === 0
              && output.push(["No Mismatched FilterChains"])
          } else if (pilotListener && !sidecarListener) {
            output.push(["Pilot Listener not found in Envoy: "])
            output.push([pilotListener])
          } else if (!pilotListener && sidecarListener) {
            output.push(["Envoy Listener not found in Pilot: "])
            output.push([sidecarListener])
          } else {
          }
        })

        this.onStreamOutput && this.onStreamOutput(output)
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
    },
  ]
}

export default plugin
