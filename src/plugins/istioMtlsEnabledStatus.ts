import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "More Istio Recipes",
  actions: [
    {
      name: "MTLS Enabled Status ",
      order: 16,
      
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput &&
          this.onOutput([["", "Istio MTLS Enabled Status"]], ActionOutputStyle.Table)

        this.showOutputLoading && this.showOutputLoading(true)

        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name, ""]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["", "Istio not installed"]])
            continue
          }
          const output: ActionOutput = []
          const k8sClient = cluster.k8sClient

          const mtlsStatus = await IstioFunctions.getMtlsStatus(k8sClient)
          output.push(["Global MTLS Enabled", mtlsStatus.isGlobalMtlsEnabled.toString()])
          mtlsStatus.namespacesWithDefaultMtls.length > 0 &&
              output.push(["Namespaces With MTLS Policies", mtlsStatus.namespacesWithDefaultMtls])

          if(mtlsStatus.servicesWithMtlsPolicies.length > 0) {
            output.push([">>Services With MTLS Policies", ""])
            const policiesByNamespace = _.groupBy(mtlsStatus.servicesWithMtlsPolicies, p => p.namespace)
            Object.keys(policiesByNamespace).forEach(namespace => {
              output.push(["Namespace: "+namespace, policiesByNamespace[namespace].map(policy => policy.name + ": " + policy.mode)])
            })
          }
          this.onStreamOutput  && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
