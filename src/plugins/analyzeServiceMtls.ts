/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, SelectionType} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import { MtlsUtil, ClientMtlsMode } from '../k8s/mtlsUtil';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Analysis Recipes",
  order: ActionContextOrder.Analysis,
  actions: [
    {
      name: "Analyze Service mTLS Status",
      order: 2,
      selectionType: SelectionType.Service,
      loadingMessage: "Loading Services...",

      choose: ChoiceManager.chooseService.bind(ChoiceManager, 1, 5),

      async act(actionContext) {
        const selections = await ChoiceManager.getServiceSelections(actionContext)
        this.directAct && this.directAct(selections)
      },

      async directAct(selections) {
        this.showTitle(selections)
        this.showOutputLoading && this.showOutputLoading(true)

        const globalMtlsStatuses = {}
        const clusterServiceMtlsStatuses = {}
        const clusters = this.actionContext.getClusters()
        for(const cluster of clusters) {
          globalMtlsStatuses[cluster.name] = await MtlsUtil.getGlobalMtlsStatus(cluster.k8sClient)
          const clusterServices = selections.filter(s => s.cluster === cluster.name).map(s => s.item)
          clusterServiceMtlsStatuses[cluster.name] = await MtlsUtil.getServiceMtlsStatuses(cluster.k8sClient, clusterServices)
        }

        for(const selection of selections) {
          const cluster = this.actionContext.getClusters().filter(c => c.name === selection.cluster)[0]
          const service = selection.item
          const output: ActionOutput = []
          output.push([">" + service.name+"."+service.namespace+" @ "+cluster.name, ""])
          if(!cluster.hasIstio) {
            output.push([">>Istio not installed", ""])
            this.onStreamOutput && this.onStreamOutput(output)
            continue
          }
          const globalMtlsStatus = globalMtlsStatuses[cluster.name]
          const serviceMtlsStatuses = clusterServiceMtlsStatuses[cluster.name]
          const namespaceMtlsStatus = serviceMtlsStatuses[service.namespace]
          const serviceMtlsStatus = namespaceMtlsStatus[service.name]
          output.push(["Cluster mTLS", globalMtlsStatus.globalMtlsMode || "Disabled"])
          output.push(["Namespace Default mTLS", namespaceMtlsStatus.namespaceDefaultMtlsMode || "N/A"])
          output.push(["Envoy Sidecar Status", serviceMtlsStatus.hasSidecar ? "Sidecar Proxy Present" : "Sidecar Proxy Not Deployed"])

          this.outputServicePolicies(serviceMtlsStatus, output)
          this.outputServiceDestinationRules(serviceMtlsStatus, output)


          const portNumbers: any[] = ["##Port"]
          const portMtls: any[] = ["mTLS"]
          const clientAccess: any[] = ["Client Access"]
          const policyConflicts: any[] = ["Policy Conflicts"]
          const drConflicts: any[] = ["DR Conflicts"]
          const impactedClients: any[] = ["Impacted Clients"]
          const portsAnalysis: any[] = []

          this.generatePortTable(service, serviceMtlsStatus, namespaceMtlsStatus, globalMtlsStatus, 
                        portNumbers, portMtls, clientAccess, policyConflicts, drConflicts, impactedClients)

          const portTable: any[] = []
          portNumbers.forEach((p,i) => {
            portTable.push([portNumbers[i], portMtls[i], clientAccess[i], policyConflicts[i], drConflicts[i], impactedClients[i]])
          })
          output.push([])
          output.push([">>>Service Ports"])
          output.push(portTable)
          output.push([])
          output.push(...portsAnalysis)

          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },

      showTitle(selections) {
        if(selections && selections.length > 0){ 
          const servicesTitle = selections.map(s => "["+s.name+"."+s.namespace+"@"+s.cluster+"]").join(", ")
          this.onOutput && this.onOutput([["mTLS Analysis for Service " + servicesTitle, ""]], ActionOutputStyle.Table)
        } else {
          this.onOutput && this.onOutput([["Service mTLS Analysis", ""]], ActionOutputStyle.Table)
        }
      },

      refresh(actionContext) {
        this.act(actionContext)
      },

      filterSelections(selections) {
        return selections && selections.length > 0 ? selections.slice(0, 5) : []
      },

      outputServicePolicies(serviceMtlsStatus, output) {
        output.push([])
        output.push([">>>Relevant Service mTLS Policies", ""])
        serviceMtlsStatus.mtlsPolicies.length === 0 
          && output.push(["", "No Policies"])
        serviceMtlsStatus.mtlsPolicies.forEach(sp => {
          delete sp.labels
          delete sp.annotations
          output.push([sp.name, sp])
        })
      },

      outputServiceDestinationRules(serviceMtlsStatus, output) {
        output.push([])
        output.push([">>>Relevant mTLS DestinationRules", ""])
        serviceMtlsStatus.mtlsDestinationRules.length === 0 
          && output.push(["","No DestinationRules"])
        serviceMtlsStatus.mtlsDestinationRules.forEach(dr => {
          delete dr.labels
          delete dr.annotations
          output.push([dr.name, dr])
        })
      },

      generatePortTable(service, serviceMtlsStatus, namespaceMtlsStatus, globalMtlsStatus, 
                        portNumbers, portMtls, clientAccess, policyConflicts, drConflicts, impactedClients) {
        service.ports.forEach(sp => {
          portNumbers.push(sp.port)
          const portStatus = serviceMtlsStatus.servicePortAccess[sp.port]
          const portDefaultMtlsDestinationRuleStatus = serviceMtlsStatus.servicePortDefaultMtlsDestinationRuleStatus[sp.port]
          const servicePortClientMtlsModes = serviceMtlsStatus.effectiveServicePortClientMtlsModes[sp.port]
          const portMtlsModes = serviceMtlsStatus.effectiveServicePortMtlsModes[sp.port]
          const portMtlsMode = portStatus.service.conflict ? "[CONFLICT] " + portMtlsModes.join(", ") :
                    !portStatus.service.mtls ? ClientMtlsMode.DISABLE :
                    portStatus.service.servicePortMtlsMode ? portStatus.service.servicePortMtlsMode : 
                    namespaceMtlsStatus.namespaceDefaultMtlsMode ? namespaceMtlsStatus.namespaceDefaultMtlsMode :
                    globalMtlsStatus.globalMtlsMode || "N/A"
          portMtls.push(portMtlsMode)

          policyConflicts.push(portStatus.service.conflict ? "[Found Policy Conflicts]" : "[No]")

          
          const clientNamespacesWithDRPolicyConflicts = Object.keys(portStatus.client.clientNamespacesInConflictWithMtlsPolicy)
          const clientNamespacesWithConflicts = portStatus.client.clientNamespacesWithMtlsConflicts
                                .concat(clientNamespacesWithDRPolicyConflicts)
          
          const impactedClientItems: any[] = []
          impactedClientItems.push(clientNamespacesWithConflicts.length === 0 ? "" :
              clientNamespacesWithConflicts.map(n => n.length > 0 ? n : "[All Sidecar Clients]"))
          clientNamespacesWithConflicts.length === 1 && clientNamespacesWithConflicts[0] === ""
                && portStatus.client.sidecarAccessNamespaces.length > 0 &&
                impactedClientItems.push(" (Except: " + portStatus.client.sidecarAccessNamespaces.map(ns => ns.namespace).join(", ") + ")")
          if(impactedClientItems.length > 0) {
            impactedClients.push(...impactedClientItems)
          }

          let drConflictsItems: any[] = []
          if(portStatus.client.conflict) {
            if(portStatus.client.clientNamespacesWithMtlsConflicts.length > 0) {
              portStatus.client.clientNamespacesWithMtlsConflicts.forEach(ns => {
                const rules = _.uniqBy(servicePortClientMtlsModes[ns].map(info => info.dr.name+"."+info.dr.namespace))
                drConflictsItems.push(rules.join(", "))
              })
            }
            if(clientNamespacesWithDRPolicyConflicts.length > 0) {
              clientNamespacesWithDRPolicyConflicts.forEach(ns => {
                const destRules = portStatus.client.clientNamespacesInConflictWithMtlsPolicy[ns]
                const ruleNames = _.uniqBy(destRules.map(dr => dr.name+"."+dr.namespace))
                drConflictsItems.push(ruleNames.join(", "))
              })
            }
          }
          if(drConflictsItems.length > 0) {
            drConflictsItems = _.uniqBy(drConflictsItems)
            drConflicts.push(drConflictsItems)
          } else {//if(!portStatus.client.conflict && clientNamespacesWithConflicts.length === 0) {
            drConflicts.push("[No]")
          }

          let clientAccessConflictMessage = portStatus.client.noAccess ? "[Blocked for all clients]" :
                portStatus.client.allAccess ? drConflictsItems.length === 0 ? "[Open to all clients]" : "[Open to all clients]<br/>[Found DR conflicts]" :
                portStatus.client.nonSidecarOnly ? "[Non-Sidecar Clients Only]" : 
                portStatus.client.sidecarOnly ? drConflictsItems.length > 0 ? "[All sidecar clients except DR conflicts]" :
                 portDefaultMtlsDestinationRuleStatus.onlyDefaultMtlsDestinationRuleDefined ? "[All sidecar clients]" : "[Select sidecar clients (see DR)]" :
                portStatus.client.conflict ? "[Some namespaces have conflicts]" : ""
          clientAccessConflictMessage.length > 0 && clientAccess.push(clientAccessConflictMessage)

        })
      },

      performPortAnalysis(service, serviceMtlsStatus, namespaceMtlsStatus, globalMtlsStatus, 
                        portNumbers, portMtls, policyConflicts, drConflicts, impactedClients, portsAnalysis) {
        service.ports.forEach(sp => {
          portsAnalysis.push([">>>Service Port " + sp.port + " Analysis"])
          portNumbers.push(sp.port)
          const portStatus = serviceMtlsStatus.servicePortAccess[sp.port]
          const portMtlsModes = serviceMtlsStatus.effectiveServicePortMtlsModes[sp.port]
          const servicePortClientMtlsModes = serviceMtlsStatus.effectiveServicePortClientMtlsModes[sp.port]
          const portMtlsMode = portStatus.service.conflict ? "[CONFLICT] " + portMtlsModes.join(",") :
                    !portStatus.service.mtls ? "N/A" :
                    portStatus.service.servicePortMtlsMode ? portStatus.service.servicePortMtlsMode : 
                    namespaceMtlsStatus.namespaceDefaultMtlsMode ? namespaceMtlsStatus.namespaceDefaultMtlsMode :
                    globalMtlsStatus.globalMtlsMode || "N/A"
          portMtls.push(portMtlsMode)

          policyConflicts.push(portStatus.service.conflict ? "[Found Policy Conflicts]" : "[No]")

          
          const clientNamespacesWithDRPolicyConflicts = Object.keys(portStatus.client.clientNamespacesInConflictWithMtlsPolicy)
          const clientNamespacesWithConflicts = portStatus.client.clientNamespacesWithMtlsConflicts
                                .concat(clientNamespacesWithDRPolicyConflicts)

          const clientConflictInfo: any[] = []
          impactedClients.push(clientNamespacesWithConflicts.length === 0 ? "" :
              clientNamespacesWithConflicts.map(n => n.length > 0 ? n : "[All Sidecar Clients]").join(", ") 
              +
              (clientNamespacesWithConflicts.length === 1 && clientNamespacesWithConflicts[0] === ""
                && portStatus.client.sidecarAccessNamespaces.length > 0 ? 
                    " (Except: " + portStatus.client.sidecarAccessNamespaces.map(ns => ns.namespace).join(", ") + ")" : "")
          )

          if(portStatus.client.conflict) {
            if(portStatus.client.clientNamespacesWithMtlsConflicts.length > 0) {
              portStatus.client.clientNamespacesWithMtlsConflicts.forEach(ns => {
                const rules = _.uniqBy(servicePortClientMtlsModes[ns].map(info => info.dr.name+"."+info.dr.namespace)).join(", ")
                drConflicts.push(rules)
                servicePortClientMtlsModes[ns].map(data => {
                  const rule = data.dr.name + "." + data.dr.namespace
                  clientConflictInfo.push(["Rule [" + rule + "] for " + (ns.length > 0 ? " namespace ["+ns+"]" : "all sidecar clients")
                          + " uses mTLS mode [" + data.mode + "]"])
                })
              })
            }
            if(clientNamespacesWithDRPolicyConflicts.length > 0) {
              clientNamespacesWithDRPolicyConflicts.forEach(ns => {
                const destRules = portStatus.client.clientNamespacesInConflictWithMtlsPolicy[ns]
                const ruleNames = _.uniqBy(destRules.map(dr => dr.name+"."+dr.namespace)).join(", ")
                drConflicts.push(ruleNames)
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
          if(!portStatus.client.conflict && clientNamespacesWithConflicts.length === 0) {
            drConflicts.push("No Conflicts")
          }

          clientConflictInfo.length > 0 && portsAnalysis.push(["DR Conflicts", clientConflictInfo])

          const clientAccess: any[] = []
          let clientAccessConflictMessage = portStatus.client.noAccess ? "Blocked for all clients" :
                portStatus.client.allAccess ? "Open to all clients" : 
                portStatus.client.nonSidecarOnly ? "Non-Sidecar Clients Only" : 
                portStatus.client.sidecarOnly ? "Sidecar Clients Only" :
                portStatus.client.conflict ? "One or more client namespaces have conflicts" : ""
          clientAccessConflictMessage.length > 0 && clientAccess.push([clientAccessConflictMessage])

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
            accessAnalysis.push("Port mTLS Modes: " + serviceMtlsStatus.effectiveServicePortMtlsModes[sp.port])
          } else {
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
                accessAnalysis.push((ns.length > 0 ? "Sidecar clients in Namespace [" + ns + "]" : "All sidecar clients")
                  + " are blocked due to DestinationRule [" + (ns.dr ? ns.dr.name : "") + "]")
              })
              clientNamespacesWithDRPolicyConflicts.forEach(ns => {
                const destRules = portStatus.client.clientNamespacesInConflictWithMtlsPolicy[ns]
                const ruleNames = _.uniqBy(destRules.map(dr => dr.name+"."+dr.namespace)).join(", ")
                accessAnalysis.push((ns.length > 0 ? "Sidecar clients in Namespace [" + ns + "]" : "All sidecar clients")
                  + " are blocked due to DestinationRules [" + ruleNames + "]")
              })
            }
            portStatus.client.sidecarAccessNamespaces.forEach(s => {
              if(s.dr) {
                accessAnalysis.push((s.namespace.length > 0 ? "Clients in Namespace [" + s.namespace + "]" : 
                  portStatus.client.conflict ? "All other client namespaces" : "All client namespaces")
                  + " can access via sidecar using DestinationRule [" + s.dr.name+"."+s.dr.namespace + "]" )
              } else {
                accessAnalysis.push((s.namespace.length > 0 ? "Clients in Namespace [" + s.namespace + "]" : 
                  portStatus.client.conflict ? "All other client namespaces" : "All client namespaces")
                  + " can access via sidecar without any DestinationRule as mTLS is not required by the service" )
              }
            })
          }
          clientAccess.push(accessAnalysis)
          portsAnalysis.push(["Client Access", clientAccess])

          if(portStatus.client.sidecarAccessNamespaces.length > 0) {
            const exceptions: string[] = []
            clientNamespacesWithDRPolicyConflicts.forEach(ns => ns.length > 0 && exceptions.push(ns))
            portStatus.client.clientNamespacesWithMtlsConflicts.forEach(ns => ns.length > 0 && exceptions.push(ns))
            portsAnalysis.push(["Client Namespaces with Sidecar access", 
              portStatus.client.sidecarAccessNamespaces.map(ns => ns.namespace.length > 0 ? ns.namespace : "All")
              +
              (exceptions.length > 0 ? 
                " (Except: " + exceptions.join(", ") + ")" : "")
            ])
          }
        })
      }
    }
  ],
}

export default plugin
