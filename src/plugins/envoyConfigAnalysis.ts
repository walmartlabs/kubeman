import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import EnvoyFunctions from '../k8s/envoyFunctions'
import ChoiceManager from '../actions/choiceManager'
import IstioFunctions from '../k8s/istioFunctions'
import K8sFunctions from '../k8s/k8sFunctions';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Envoy Proxy Recipes",
  order: ActionContextOrder.Istio+3,
  actions: [
    {
      name: "Envoy Sidecar Config for Service",
      order: 40,
      loadingMessage: "Loading Envoy Proxies and Services...",

      choose(actionContext) {
        ChoiceManager.doubleChoices(this, actionContext,
          IstioPluginHelper.chooseEnvoyProxy.bind(IstioPluginHelper, 1, 3, actionContext),
          IstioPluginHelper.getSelectedEnvoyProxies.bind(IstioPluginHelper, actionContext),
          ChoiceManager.chooseService.bind(ChoiceManager,1, 3, actionContext),
          ChoiceManager.getSelections.bind(ChoiceManager, actionContext)
        )
      },

      async act(actionContext) {
        this.clear && this.clear(actionContext)
        const selections = await ChoiceManager.getDoubleSelections(actionContext)
        const sidecars = selections[0]
        const services = selections[1]
        if(sidecars.length < 1) {
          this.onOutput && this.onOutput([["No sidecar selected"]], ActionOutputStyle.Text)
          return
        }
        if(services.length < 1) {
          this.onOutput && this.onOutput([["No service selected"]], ActionOutputStyle.Text)
          return
        }
        this.showOutputLoading && this.showOutputLoading(true)
        for(const sidecar of sidecars) {
          const cluster = actionContext.getClusters().filter(c => c.name === sidecar.cluster)[0]
          for(const service of services) {
            const output: ActionOutput = []
            const sidecarName = sidecar.pod+"."+ sidecar.namespace
            output.push([">Service: "+service.name+"."+service.namespace + 
                          " @ Envoy Sidecar: " + sidecarName + " @ Cluster: " + sidecar.cluster])

            const configsByType = await EnvoyFunctions.getEnvoyConfigsForService(service.name, service.namespace,
                                          sidecar.namespace, sidecar.pod, "istio-proxy", cluster.k8sClient)

            Object.keys(configsByType).forEach(configType => {
              const items = configsByType[configType]
              output.push([">>" + configType])
              items.length === 0 && output.push(["No matching data found"])
              items.length > 0 && items.forEach(item => output.push([">>>"+ item.title], [delete item.title && item]))
            })

            const podDetails = await K8sFunctions.getPodDetails(sidecar.namespace, sidecar.pod, cluster.k8sClient)
            if(podDetails) {
              const egressSidecarConfigs = await IstioFunctions.getPodEgressSidecarConfigs(podDetails.labels, podDetails.namespace, cluster.k8sClient)
              if(egressSidecarConfigs && egressSidecarConfigs.length > 0) {
                output.push([">>Egress Sidecar Configs for " + sidecarName])
                egressSidecarConfigs.forEach(sc => output.push([sc.yaml]))
              } else {
                output.push([">>No Egress Sidecar Configs found for " + sidecarName])
              }
            }
            this.onStreamOutput && this.onStreamOutput(output)
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },

      clear() {
        this.onOutput && this.onOutput([["Sidecar Envoy Config for Service"]], ActionOutputStyle.Log)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      onActionOption(actionContext, option) {
        console.log(option)
      }
    }
  ]
}

export default plugin
