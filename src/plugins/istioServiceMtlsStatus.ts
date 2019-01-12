import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Recipes",
  actions: [
    {
      name: "Services MTLS Report",
      order: 17,
      
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput &&
          this.onOutput([["Service", "Policy/Dest Rule", 
                    "Client/Server Protocol", "Status"]], ActionOutputStyle.Table)

        this.showOutputLoading && this.showOutputLoading(true)

        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name, "", "", ""]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["", "Istio not installed", "", ""]])
            continue
          }
          const output: ActionOutput = []
          const k8sClient = cluster.k8sClient

          const serviceMtlsStatus = await IstioFunctions.getServiceMtlsStatuses(k8sClient)

          if(serviceMtlsStatus.length > 0) {
            const statusByNamespace = _.groupBy(serviceMtlsStatus, status => status.namespace)
            Object.keys(statusByNamespace).forEach(namespace => {
              output.push([">>"+namespace, "", "", ""])
              statusByNamespace[namespace].forEach(status => {
                status.policy = status.policy === "-" ? "" : status.policy
                status.destinationRule = status.destinationRule === "-" ? "" : status.destinationRule
                const policyRuleOutput: string[] = []
                status.policy.length > 0 && policyRuleOutput.push("Policy: " + status.policy)
                status.destinationRule.length > 0 && policyRuleOutput.push("DestRule: " + status.destinationRule)
                output.push([status.serviceName+":"+status.port, 
                            policyRuleOutput,
                            status.clientProtocol+"/"+status.serverProtocol
                              +(status.serviceMtlsMode ? "("+status.serviceMtlsMode+")" : ""), 
                              status.status])
              })
            })
          } else {
            output.push([">>Couldn't load mtls status or No services", "", "", ""])
          }
          this.onStreamOutput  && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
