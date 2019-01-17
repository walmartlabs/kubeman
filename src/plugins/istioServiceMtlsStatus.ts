import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions'
import K8sFunctions from '../k8s/k8sFunctions';
import IstioPluginHelper from '../k8s/istioPluginHelper';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "More Istio Recipes",
  actions: [
    {
      name: "Services MTLS Report",
      order: 17,
      
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const selectedNamespaes = actionContext.getNamespaces().map(ns => ns.name)
        this.onOutput &&
          this.onOutput([["Service", "Policy/Dest Rule", "Client mTLS Required?", 
                      "Server mTLS Enforced?", "Using Sidecar?", "Accessible"]], ActionOutputStyle.Table)

        this.showOutputLoading && this.showOutputLoading(true)

        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name, "", "", "", "", ""]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["", "Istio not installed", "", "", "", ""]])
            continue
          }
          const k8sClient = cluster.k8sClient

          const serviceMtlsStatus = await IstioFunctions.getServiceMtlsStatuses(k8sClient)
          if(serviceMtlsStatus.length > 0) {
            const statusByNamespace = _.groupBy(serviceMtlsStatus, status => status.namespace)
            for(const namespace in statusByNamespace) {
              if(!selectedNamespaes.includes(namespace)) {
                continue
              }
              const output: ActionOutput = []

              output.push([">>"+namespace, "", "", "", "", ""])
              for(const status of statusByNamespace[namespace]) {
                status.policy = status.policy === "-" ? "" : status.policy

                status.destinationRule = status.destinationRule === "-" ? undefined : status.destinationRule
                const serviceDetails = await K8sFunctions.getServiceDetails(namespace, status.serviceName, k8sClient)

                const policyRuleOutput: string[] = []
                status.policy && status.policy.length > 0 && policyRuleOutput.push("Policy: " + status.policy)
                status.destinationRule && status.destinationRule.length > 0 && policyRuleOutput.push("DestRule: " + status.destinationRule)
                
                const mtlsAccessStatus = await IstioPluginHelper.getServiceMtlsAccessStatus(namespace, serviceDetails, status, k8sClient)

                output.push([status.serviceName+":"+status.port, 
                            policyRuleOutput,
                            mtlsAccessStatus.isClientMtlsRequired ? "Yes" : "No",
                            (mtlsAccessStatus.isServerMtlsEnforced ? mtlsAccessStatus.isServerMtlsPermissive ? "Permissive" : "Yes" : "No"),
                            mtlsAccessStatus.hasSidecar ? "Yes" : "No",
                            mtlsAccessStatus.access])
              }
              this.onStreamOutput  && this.onStreamOutput(output)
            }
          } else {
            this.onStreamOutput  && 
              this.onStreamOutput([[">>Couldn't load mtls status or No services", "", "", "", ""]])
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
