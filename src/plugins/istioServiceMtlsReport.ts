import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions'
import K8sFunctions from '../k8s/k8sFunctions';
import IstioPluginHelper from '../k8s/istioPluginHelper';
import K8sPluginHelper from '../k8s/k8sPluginHelper';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "More Istio Recipes",
  actions: [
    {
      name: "Services MTLS Report",
      order: 106,
      loadingMessage: "Loading Namespaces...",

      choose: K8sPluginHelper.chooseNamespaces.bind(K8sPluginHelper, false, 1, 5),
      
      async act(actionContext) {
        const selections = await K8sPluginHelper.getSelections(actionContext)
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No namespace selected"]], ActionOutputStyle.Text)
          return
        }

        const clusters = actionContext.getClusters()

        this.onOutput &&
          this.onOutput([["Service", "Policy/Dest Rule", "Using Sidecar?", 
                          "Server mTLS Enforced?", "Client mTLS Required?", 
                          "Client mTLS Disabled?", "Access"]], ActionOutputStyle.Table)

        this.showOutputLoading && this.showOutputLoading(true)

        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name, "", "", "", "", "", ""]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["", "Istio not installed", "", "", "", "", ""]])
            continue
          }
          let clusterNamespaces = selections.filter(s => s.cluster === cluster.name)
                                        .map(s => s.item).map(ns => ns.name)
          if(clusterNamespaces.length === 0) {
            this.onStreamOutput  && this.onStreamOutput([["No Namespace Selected", "", "", "", "", "", ""]])
            continue
          }
          const k8sClient = cluster.k8sClient

          const mtlsStatus = await IstioFunctions.getMtlsStatus(k8sClient)
          const mtlsStatusOutput: ActionOutput = []
          mtlsStatusOutput.push(["Global MTLS Enabled", mtlsStatus.isGlobalMtlsEnabled.toString(), "", "", "", "", ""])
          if(mtlsStatus.servicesWithMtlsPolicies.length > 0) {
            const policiesByNamespace = _.groupBy(mtlsStatus.servicesWithMtlsPolicies, p => p.namespace)

            mtlsStatusOutput.push([">>Services With MTLS Policies", "", "", "", "", "", ""])
            Object.keys(policiesByNamespace)
              .filter(ns => clusterNamespaces.includes(ns))
              .map(ns => policiesByNamespace[ns])
              .forEach(services => {
                  mtlsStatusOutput.push(["", services])
            })
          }
          this.onStreamOutput  && this.onStreamOutput(mtlsStatusOutput)

          const serviceMtlsStatus = await IstioFunctions.getServiceMtlsStatuses(k8sClient)
          if(serviceMtlsStatus.length > 0) {
            const statusByNamespace = _.groupBy(serviceMtlsStatus, status => status.namespace)
            for(const namespace in statusByNamespace) {
              if(!clusterNamespaces.includes(namespace)) {
                continue
              }
              const output: ActionOutput = []

              output.push([">>"+namespace, "", "", "", "", "", ""])
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
                            mtlsAccessStatus.hasSidecar ? "Yes" : "No",
                            (mtlsAccessStatus.isServerMtlsEnforced ? mtlsAccessStatus.isServerMtlsPermissive ? "Permissive" : "Yes" : "No"),
                            mtlsAccessStatus.isClientMtlsRequired ? "Yes" : "No",
                            mtlsAccessStatus.isClientMtlsDisabled ? "Yes" : "No",
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
      refresh(actionContext) {
        this.act(actionContext)
      }
    }
  ]
}

export default plugin
