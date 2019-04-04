import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import { MtlsUtil } from '../k8s/mtlsUtil';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "More Istio Recipes",
  actions: [
    {
      name: "Analyze Service mTLS Status",
      order: 111,
      loadingMessage: "Loading Services...",

      async choose(actionContext) {
        await ChoiceManager.prepareCachedChoices(actionContext, K8sFunctions.getServices, "Services", 
                                              1, 10, true, "name")
      },

      async act(actionContext) {
        this.clear && this.clear(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)

        const selections: ItemSelection[] = await ChoiceManager.getSelections(actionContext)
        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          const clusterSelections = selections.filter(s => s.cluster === cluster.name)
          if(clusterSelections.length === 0) {
            continue
          }
          const output: ActionOutput = []
          output.push([">Cluster: "+cluster.name, ""])
          if(!cluster.hasIstio) {
            output.push([">>Istio not installed", ""])
            this.onStreamOutput && this.onStreamOutput(output)
            continue
          }          
          const globalMtlsStatus = await MtlsUtil.getGlobalMtlsStatus(cluster.k8sClient)
          output.push(["Cluster mTLS", globalMtlsStatus.globalMtlsMode || "Disabled"])

          const services = clusterSelections.map(s => s.item)

          const serviceMtlsStatuses = await MtlsUtil.getServiceMtlsStatuses(cluster.k8sClient, services)
          services.forEach(service => {
            const namespace = service.namespace
            const namespaceMtlsStatus = serviceMtlsStatuses[namespace]
            const serviceMtlsStatus = namespaceMtlsStatus[service.name]

            output.push([">>Service: " + service.name + ", Namespace: " + namespace, ""])

            output.push([])
            output.push([">>>Service Details", ""])
            output.push(["name", service.name])
            output.push(["namespace", service.namespace])
            output.push(["type", service.type])
            output.push(["clusterIP", service.clusterIP])
            output.push(["ports", service.ports])
            output.push(["selector", service.selector])
            output.push(["Envoy Sidecar Status", 
                serviceMtlsStatus.hasSidecar ? "Sidecar Proxy Present" : "Sidecar Proxy Not Deployed"])

            output.push([])
            output.push([">>>Namespace Default mTLS", ""])
            output.push(["mTLS Mode", namespaceMtlsStatus.namespaceDefaultMtlsMode || "None"])

            output.push([])
            output.push([">>>Relevant Service mTLS Policies", ""])
            serviceMtlsStatus.servicePoliciesMtlsStatus.mtlsPolicies.length === 0 
              && output.push(["", "No Policies"])
            serviceMtlsStatus.servicePoliciesMtlsStatus.mtlsPolicies.forEach(sp => {
              output.push([sp.name, sp])
            })
            output.push([])
            output.push([">>>Relevant mTLS Destination Rules", ""])
            serviceMtlsStatus.serviceDestRulesMtlsStatus.mtlsDestinationRules.length === 0 
              && output.push(["","No DestinationRules"])
            serviceMtlsStatus.serviceDestRulesMtlsStatus.mtlsDestinationRules.forEach(dr => {
              delete dr.data
              output.push([dr.name, dr])
            })

            service.ports.forEach(sp => {
              output.push([">>>Port: " + sp.port, ""])
              const portStatus = serviceMtlsStatus.servicePortAccess[sp.port]
              const servicePortClientMtlsModes = serviceMtlsStatus.serviceDestRulesMtlsStatus.effectiveServicePortClientMtlsModes[sp.port]

              output.push(["mTLS Enabled", portStatus.service.mtls ? "Yes" : "No"])

              portStatus.service.mtls && output.push(["mTLS Policy Conflict",
                  portStatus.service.conflict ? "Has Conflicts" : "No Conflicts"])

              const portMtlsMode = portStatus.service.conflict ? "Conflict" :
                        !portStatus.service.mtls ? "None" :
                        portStatus.service.servicePortMtlsMode ? portStatus.service.servicePortMtlsMode : 
                        namespaceMtlsStatus.namespaceDefaultMtlsMode ? namespaceMtlsStatus.namespaceDefaultMtlsMode :
                        globalMtlsStatus.globalMtlsMode || "None"
              portStatus.service.mtls && output.push(["mTLS Mode", portMtlsMode])
              
              const clientNamespacesWithDRPolicyConflicts = Object.keys(portStatus.client.clientNamespacesInConflictWithMtlsPolicy)
              const clientNamespacesWithConflicts = portStatus.client.clientNamespacesWithMtlsConflicts
                                    .concat(clientNamespacesWithDRPolicyConflicts)
              output.push(["Client Namespaces with conflicts", 
                clientNamespacesWithConflicts.length === 0 ? "No Conflicts" :
                  clientNamespacesWithConflicts.map(n => n.length > 0 ? n : "All Sidecar Clients").join(", ") 
                  +
                  (clientNamespacesWithConflicts.length === 1 && clientNamespacesWithConflicts[0] === ""
                    && portStatus.client.sidecarAccessNamespaces.length > 0 ? 
                        " (Except: " + portStatus.client.sidecarAccessNamespaces.map(ns => ns.namespace).join(", ") + ")" : "")
              ])

              const clientConflictInfo: any[] = []
              if(portStatus.client.conflict) {
                if(portStatus.client.clientNamespacesWithMtlsConflicts.length > 0) {
                  clientConflictInfo.push("Client namespaces and corresponding DestinationRules with conflicting mTLS config:")
                  portStatus.client.clientNamespacesWithMtlsConflicts.forEach(ns => {
                    const rules = _.uniqBy(servicePortClientMtlsModes[ns].map(info => info.dr.name+"."+info.dr.namespace)).join(", ")
                    ns.length > 0 && clientConflictInfo.push(["Conflict in Namespace [" + ns + "] caused by DestinationRule(s): "+ rules])
                    ns.length === 0 && clientConflictInfo.push(["All sidecar client namespaces are conflicted due to these DestinationRule(s): "+ rules])
                    servicePortClientMtlsModes[ns].map(data => {
                      const rule = data.dr.name + "." + data.dr.namespace
                      clientConflictInfo.push(["Rule [" + rule + "] for " + (ns.length > 0 ? " namespace ["+ns+"]" : "all sidecar clients")
                              + " uses mTLS mode [" + data.mode + "]"])
                    })
                  })
                }
                if(clientNamespacesWithDRPolicyConflicts.length > 0) {
                  clientConflictInfo.push("Client namespaces and corresponding DestinationRules in conflict with service policy:")
                  clientNamespacesWithDRPolicyConflicts.forEach(ns => {
                    const destRules = portStatus.client.clientNamespacesInConflictWithMtlsPolicy[ns]
                    const ruleNames = _.uniqBy(destRules.map(dr => dr.name+"."+dr.namespace)).join(", ")
                    ns.length > 0 && clientConflictInfo.push(["Conflict in Namespace [" + ns + "] caused by DestinationRule(s): "+ ruleNames])
                    ns.length === 0 && clientConflictInfo.push(["All sidecar client namespaces are conflicted due to these DestinationRule(s): "+ ruleNames])
                    servicePortClientMtlsModes[ns].map(data => {
                      const rule = data.dr.name + "." + data.dr.namespace
                      clientConflictInfo.push([
                        "Rule [" + rule + "] uses mTLS mode [" + data.mode + "] for " 
                          + (ns.length > 0 ? " namespace ["+ns+"]" : "all sidecar clients")
                          + (serviceMtlsStatus.hasSidecar ? 
                              "  whereas service port mTLS mode is [" + portMtlsMode + "]" :
                              "  whereas service runs without sidecar and does not support mTLS")
                      ])
                    })
                  })
                }
              }
              output.push(["Client Conflict Analysis", clientConflictInfo])

              output.push(["Client Access",
                portStatus.client.conflict ? "Conflict" :
                  portStatus.client.noAccess ? "Blocked for all clients" :
                    portStatus.client.allAccess ? "Open to all clients" : 
                    portStatus.service.mtls && !portStatus.service.permissive ? "Sidecar-Clients Only" : ""
              ])

              const accessAnalysis: any[] = []
              if(namespaceMtlsStatus.namespaceDefaultMtlsMode) {
                if(portStatus.service.servicePortMtlsMode &&
                  namespaceMtlsStatus.namespaceDefaultMtlsMode !== portStatus.service.servicePortMtlsMode) {
                  accessAnalysis.push("Service policy has overridden mTLS mode from namespace default of ["
                    + namespaceMtlsStatus.namespaceDefaultMtlsMode + "] to [" + portStatus.service.servicePortMtlsMode + "]")
                }
              } else {
                if(portStatus.service.servicePortMtlsMode &&
                  globalMtlsStatus.globalMtlsMode !== portStatus.service.servicePortMtlsMode) {
                  accessAnalysis.push("Service policy has overridden mTLS mode from global default of ["
                    + globalMtlsStatus.globalMtlsMode + "] to [" + portStatus.service.servicePortMtlsMode + "]")
                }
              }

              if(portStatus.service.conflict) {
                accessAnalysis.push("Service policies have conflicting mTLS configuration")
                accessAnalysis.push("Port mTLS Modes: " + serviceMtlsStatus.servicePoliciesMtlsStatus.effectiveServicePortMtlsModes[sp.port])
              } else {
                !portStatus.service.mtls && accessAnalysis.push("Port does not require mTLS")
                portStatus.service.mtls && portStatus.service.permissive 
                  && accessAnalysis.push("Service has given PERMISSIVE mTLS access to allow access without a sidecar")
                portStatus.service.mtls && !portStatus.service.permissive 
                  && accessAnalysis.push("Service requires STRICT mTLS access, and cannot be accessed without a sidecar")
                portStatus.client.noDestinationRules && portStatus.service.permissive
                  && accessAnalysis.push("No DestinationRule is defined to configure mTLS, so sidecar clients will also access without mTLS")
                portStatus.service.mtls && !portStatus.service.permissive  && portStatus.client.noDestinationRules 
                  && accessAnalysis.push("Sidecar mTLS access requires a DestinationRule, but none are defined for this port")
                if(clientNamespacesWithConflicts.length > 0) {
                  portStatus.client.clientNamespacesWithMtlsConflicts.forEach(ns => {
                    accessAnalysis.push((ns.length > 0 ? "Clients in Namespace [" + ns + "]" : 
                      portStatus.client.conflict ? "All other client namespaces" : "All client namespaces")
                      + " cannot access due to incorrect DestinationRule [" + (ns.dr ? ns.dr.name : "") + "]")
                  })
                  clientNamespacesWithDRPolicyConflicts.forEach(ns => {
                    const destRules = portStatus.client.clientNamespacesInConflictWithMtlsPolicy[ns]
                    const ruleNames = _.uniqBy(destRules.map(dr => dr.name+"."+dr.namespace)).join(", ")
                    accessAnalysis.push((ns.length > 0 ? "Clients in Namespace [" + ns + "]" : 
                      portStatus.client.conflict ? "All other client namespaces" : "All client namespaces")
                      + " cannot access due to incorrect DestinationRules [" + ruleNames + "]")
                  })
                }
                portStatus.client.sidecarAccessNamespaces.forEach(s => {
                  if(s.dr) {
                    accessAnalysis.push((s.namespace.length > 0 ? "Clients in Namespace [" + s.namespace + "]" : 
                      portStatus.client.conflict ? "All other client namespaces" : "All client namespaces")
                      + " can access via sidecar due to DestinationRule [" + s.dr.name+"."+s.dr.namespace + "]" )
                  } else {
                    accessAnalysis.push((s.namespace.length > 0 ? "Clients in Namespace [" + s.namespace + "]" : 
                      portStatus.client.conflict ? "All other client namespaces" : "All client namespaces")
                      + " can access via sidecar without any DestinationRule as mTLS is not required by the service" )
                  }
                })
              }
              output.push(["Client Access Analysis", [accessAnalysis]])

              if(portStatus.client.sidecarAccessNamespaces.length > 0) {
                const exceptions: string[] = []
                clientNamespacesWithDRPolicyConflicts.forEach(ns => ns.length > 0 && exceptions.push(ns))
                portStatus.client.clientNamespacesWithMtlsConflicts.forEach(ns => ns.length > 0 && exceptions.push(ns))
                output.push(["Client Namespaces with Sidecar access", 
                  portStatus.client.sidecarAccessNamespaces.map(ns => ns.namespace.length > 0 ? ns.namespace : "All")
                  +
                  (exceptions.length > 0 ? 
                    " (Except: " + exceptions.join(", ") + ")" : "")
                ])
              }
            })
          })
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      async clear(actionContext) {
        const selections: ItemSelection[] = await ChoiceManager.getSelections(actionContext)
        const servicesTitle = selections.map(s => "["+s.name+"."+s.namespace+"@"+s.cluster+"]").join(", ")
        this.onOutput && this.onOutput([["Service mTLS Analysis for ", servicesTitle]], ActionOutputStyle.Table)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    }
  ],
}

export default plugin
