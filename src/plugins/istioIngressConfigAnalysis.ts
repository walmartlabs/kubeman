import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import ActionContext from '../actions/actionContext';
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions';
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import EnvoyFunctions, {EnvoyConfigType} from '../k8s/envoyFunctions'
import {compareEnvoyConfigs} from './envoySidecarConfigComparison'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "Compare Envoy Configs of IngressGateway Pods",
      order: 30,
      loadingMessage: "Loading IngressGateway Pods...",

      async choose(actionContext) {
        await ChoiceManager.chooseServicePods("istio-ingressgateway", "istio-system", 
                      2, 2, false, true, actionContext)
      },

      async act(actionContext) {
        const selections = await ChoiceManager.getPodSelections(actionContext, false)
        this.onOutput && this.onOutput([["IngressGateway Sidecar Config Comparison", ""]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const pod1 = selections[0]
        const cluster1 = actionContext.getClusters().filter(c => c.name === pod1.cluster)[0]
        const ingress1Configs = await EnvoyFunctions.getEnvoyConfigDump(cluster1.k8sClient, pod1.namespace, pod1.podName, "istio-proxy")
        const pod1Details = await K8sFunctions.getPodDetails(pod1.namespace, pod1.podName, cluster1.k8sClient)
        const pod1IP = pod1Details && pod1Details.podIP

        const pod2 = selections[1]
        const cluster2 = actionContext.getClusters().filter(c => c.name === pod2.cluster)[0]
        const ingress2Configs = await EnvoyFunctions.getEnvoyConfigDump(cluster2.k8sClient, pod2.namespace, pod2.podName, "istio-proxy")
        const pod2Details = await K8sFunctions.getPodDetails(pod2.namespace, pod2.podName, cluster2.k8sClient)
        const pod2IP = pod2Details && pod2Details.podIP
        
        const keysToIgnore: string[] = ["uid"]

        const valuesToIgnore: string[] = []
        pod1IP && valuesToIgnore.push(pod1IP)
        pod2IP && valuesToIgnore.push(pod2IP)

        compareEnvoyConfigs(this.onStreamOutput, ingress1Configs, ingress2Configs, EnvoyConfigType.Clusters, false, "cluster", "cluster", keysToIgnore, valuesToIgnore)

        compareEnvoyConfigs(this.onStreamOutput, ingress1Configs, ingress2Configs, EnvoyConfigType.Listeners, false, "listener", "listener", keysToIgnore, valuesToIgnore)

        compareEnvoyConfigs(this.onStreamOutput, ingress1Configs, ingress2Configs, EnvoyConfigType.Routes, false, "route_config", "route_config", keysToIgnore, valuesToIgnore)

        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    }
  ]
}

export default plugin
