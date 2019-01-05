import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Recipes",
  actions: [
    {
      name: "Services MTLS Report",
      order: 14,
      
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput &&
          this.onOutput([["Service", "Policy/Dest Rule", 
                    "Client/Server Protocol", "Status"]], ActionOutputStyle.Table)

        for(const i in clusters) {
          const cluster = clusters[i]
          const output: ActionOutput = []
          const k8sClient = cluster.k8sClient

          output.push([">Cluster: " + cluster.name, "", "", ""])
          const serviceMtlsStatus = await IstioFunctions.getServiceMtlsStatuses(k8sClient)

          if(serviceMtlsStatus.length > 0) {
            const statusByNamespace = _.groupBy(serviceMtlsStatus, status => status.namespace)
            Object.keys(statusByNamespace).forEach(namespace => {
              output.push([">>"+namespace, "", "", ""])
              statusByNamespace[namespace].forEach(status => {
                output.push([status.serviceName+":"+status.port, 
                            ["Policy: " + status.policy, "Rule: " + status.destinationRule],
                            status.clientProtocol+"/"+status.serverProtocol
                              +(status.serviceMtlsMode ? "("+status.serviceMtlsMode+")" : ""), 
                              status.status])
              })
            })
          } else {
            output.push([">>No Services", ""])
          }
          this.onStreamOutput  && this.onStreamOutput(output)
        }
      },
    }
  ]
}

export default plugin
