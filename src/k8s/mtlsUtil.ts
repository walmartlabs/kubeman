import IstioFunctions from "./istioFunctions";
import { K8sClient } from "./k8sClient";
import K8sFunctions from "./k8sFunctions";
import { ServiceDetails } from "./k8sObjectTypes";
import {isGlobalFqdn, isNamespaceFqdn, isServiceFqdn} from '../util/matchUtil'

export interface GlobalMtlsStatus {
  isGlobalMtlsEnabled: boolean
  isGlobalMtlsPermissive: boolean
  globalMtlsMode: string
}

export interface MtlsPolicyInfo {
  namespace: string,
  serviceName: string,
  policyName: string,
  ports: any[],
  peers: any[],
  mode: string,
  policy: any
}

export class MtlsUtil {

  static getGlobalMtlsStatus = async (k8sClient: K8sClient) => {
    let isGlobalMtlsEnabled: boolean = false
    let globalMtlsMode = ''
    const defaultMeshPolicy = (await IstioFunctions.listAllMeshPolicies(k8sClient))
            .filter(policy => policy.name === 'default')
    if(defaultMeshPolicy && defaultMeshPolicy.length > 0) {
      isGlobalMtlsEnabled = true
      globalMtlsMode = defaultMeshPolicy[0].peers
                          .filter(p => p.mtls)
                          .map(p => p.mtls.mode||"STRICT")[0]
    }
    return {
      isGlobalMtlsEnabled,
      isGlobalMtlsPermissive: globalMtlsMode && (globalMtlsMode.toLowerCase() === "permissive") ? true : false,
      globalMtlsMode,
    } as GlobalMtlsStatus
  }

  static getMtlsPolicies = async (k8sClient: K8sClient) => {
    const namespacesWithDefaultMtls = {}
    const namespaceDefaultMtlsPolicies = {}
    const servicesWithMtlsPolicies: any[] = []

    const policies = await IstioFunctions.listAllPolicies(k8sClient, false)
    if(policies && policies.length) {
      policies
        .filter(policy => policy.name === 'default'&& !policy.targets &&
                      policy.peers && policy.peers.filter(peer => peer.mtls).length > 0)
        .forEach(policy => {
          namespaceDefaultMtlsPolicies[policy.namespace] = policy
          const peerMtls = policy.peers.filter(peer => peer.mtls)
                            .map(peer => peer.mtls)[0]
          namespacesWithDefaultMtls[policy.namespace] = peerMtls.mode || "STRICT"
        })

      policies
        .filter(policy => policy.name !== 'default' &&
                      policy.peers && policy.peers.filter(peer => peer.mtls).length > 0
                      && policy.targets && policy.targets.length > 0)

        .forEach(policy => policy.targets.forEach(target => 
          servicesWithMtlsPolicies.push({
                serviceName: target.name,
                ports: target.ports,
                policyName: policy.name,
                namespace: policy.namespace,
                peers: policy.peers,
                mode: policy.peers.filter(peer => peer.mtls)
                        .map(peer => peer.mtls.mode ? peer.mtls.mode : "STRICT")[0],
                policy
          })
        ))
    }


    return {
      namespacesWithDefaultMtls,
      namespaceDefaultMtlsPolicies,
      servicesWithMtlsPolicies
    }
  }

  static getMtlsDestinationRules = async (k8sClient: K8sClient) => {
    const mtlsDestinationRules = IstioFunctions.extractDestinationRules(await k8sClient.istio.destinationrules.get())
              .filter(r => r.trafficPolicy && 
                ((r.trafficPolicy.tls && r.trafficPolicy.tls.mode)
                || (r.trafficPolicy.portLevelSettings && 
                  r.trafficPolicy.portLevelSettings.filter(p => p.tls).length > 0)))

    const globalRules : any[] = []
    const allToNSRules = {}
    const allTo3rdPartyNSRules = {}
    const allToServiceRules = {}
    const allTo3rdPartyServiceRules = {}
    const nsToAllRules = {}
    const nsToNSRules = {}
    const nsToServiceRules = {}

    mtlsDestinationRules.forEach(dr => {
      if(dr.host) {
        dr.data = {}
        dr.data.isGlobalExport = true //dr.exportTo && dr.exportTo.includes("*")
        dr.data.sourceNamespace = dr.namespace
        dr.data.isTargetGlobal = isGlobalFqdn(dr.host)
        dr.data.isTargetNamespace = isNamespaceFqdn(dr.host)
        dr.data.isTargetService = isServiceFqdn(dr.host)
        dr.data.targetService = dr.data.isTargetService ? dr.host : undefined
        dr.data.targetNamespace = (dr.data.isTargetNamespace || dr.data.targetService) && dr.host.split(".")[1]

        if(dr.data.isGlobalExport) {
          if(dr.data.isTargetGlobal) {
            globalRules.push(dr)
          } else if(dr.data.isTargetNamespace) {
            const store = dr.data.targetNamespace === dr.data.sourceNamespace ? allToNSRules : allTo3rdPartyNSRules
            if(!store[dr.data.sourceNamespace]) {
              store[dr.data.sourceNamespace] = {}
            }
            if(!store[dr.data.sourceNamespace][dr.data.targetNamespace]) {
              store[dr.data.sourceNamespace][dr.data.targetNamespace] = []
            }
            store[dr.data.sourceNamespace][dr.data.targetNamespace].push(dr)
          } else if(dr.data.isTargetService) {
            const store = dr.data.targetNamespace === dr.data.sourceNamespace ? allToServiceRules : allTo3rdPartyServiceRules
            if(!store[dr.data.sourceNamespace]) {
              store[dr.data.sourceNamespace] = {}
            }
            if(!store[dr.data.sourceNamespace][dr.data.targetService]) {
              store[dr.data.sourceNamespace][dr.data.targetService] = []
            }
            store[dr.data.sourceNamespace][dr.data.targetService].push(dr)
          }
        } else {
          if(dr.data.isTargetGlobal) {
            if(!nsToAllRules[dr.data.sourceNamespace]) {
              nsToAllRules[dr.data.sourceNamespace] = []
            }
            nsToAllRules[dr.data.sourceNamespace].push(dr)
          } else if(dr.data.isTargetNamespace) {
            if(!nsToNSRules[dr.data.sourceNamespace]) {
              nsToNSRules[dr.data.sourceNamespace] = {}
            }
            if(!nsToNSRules[dr.data.sourceNamespace][dr.data.targetNamespace]) {
              nsToNSRules[dr.data.sourceNamespace][dr.data.targetNamespace] = []
            }
            nsToNSRules[dr.data.sourceNamespace][dr.data.targetNamespace].push(dr)
          } else if(dr.data.isTargetService) {
            if(!nsToServiceRules[dr.data.sourceNamespace]) {
              nsToServiceRules[dr.data.sourceNamespace] = {}
            }
            if(!nsToServiceRules[dr.data.sourceNamespace][dr.data.targetService]) {
              nsToServiceRules[dr.data.sourceNamespace][dr.data.targetService] = []
            }
            nsToServiceRules[dr.data.sourceNamespace][dr.data.targetService].push(dr)
          }
        }
      }
    })

    let currentLevelPortTlsModes = {}
    const extractDestinationRuleTlsModes = (dr, map, map2?) => {
      if(dr.trafficPolicy) {
        if(dr.trafficPolicy.tls && dr.trafficPolicy.tls.mode) {
          Object.keys(map).forEach(key => {
            if(currentLevelPortTlsModes[key]) {
              map[key].push({mode: dr.trafficPolicy.tls.mode, dr})
              map2 && map2[key].push(dr.trafficPolicy.tls.mode)
            } else {
              currentLevelPortTlsModes[key]=true
              map[key] = [{mode: dr.trafficPolicy.tls.mode, dr}]
              map2 && (map2[key] = [dr.trafficPolicy.tls.mode])
            }
          })
          if(currentLevelPortTlsModes[""]) {
            map[""].push({mode: dr.trafficPolicy.tls.mode, dr})
            map2 && map2[""].push(dr.trafficPolicy.tls.mode)
          } else {
            currentLevelPortTlsModes[""]=true
            map[""] = [{mode: dr.trafficPolicy.tls.mode, dr}]
            map2 && (map2[""] = [dr.trafficPolicy.tls.mode])
          }
        }
        dr.trafficPolicy.portLevelSettings &&
          dr.trafficPolicy.portLevelSettings.forEach(p => {
            if(p.port && p.tls && p.tls.mode) {
              const portId = p.port.number || p.port.name
              if(currentLevelPortTlsModes[portId]) {
                map[portId].push({mode: p.tls.mode, dr})
                map2 && map2[portId].push(p.tls.mode)
              } else {
                currentLevelPortTlsModes[portId]=true
                map[portId] = [{mode: p.tls.mode, dr}]
                map2 && (map2[portId] = [p.tls.mode])
              }
            }
          })
      }
    }

    const globalClientMtlsModes = {}
    currentLevelPortTlsModes = {}
    globalRules.filter(dr => dr.host === "*")
      .forEach(dr => extractDestinationRuleTlsModes(dr, globalClientMtlsModes))
    currentLevelPortTlsModes = {}
    globalRules.filter(dr => dr.host === "*.local")
      .forEach(dr => extractDestinationRuleTlsModes(dr, globalClientMtlsModes))
    currentLevelPortTlsModes = {}
    globalRules.filter(dr => dr.host === "*.cluster.local")
      .forEach(dr => extractDestinationRuleTlsModes(dr, globalClientMtlsModes))
    currentLevelPortTlsModes = {}
    globalRules.filter(dr => dr.host === "*.svc.cluster.local")
      .forEach(dr => extractDestinationRuleTlsModes(dr, globalClientMtlsModes))
    const nsToNSMtlsModes = {}
    const nsToNSPriorityMtlsModes = {}

    Object.keys(allTo3rdPartyNSRules).forEach(sourceNS => {
      if(!nsToNSMtlsModes[""]) {
        nsToNSMtlsModes[""] = {}
      }
      Object.keys(allTo3rdPartyNSRules[sourceNS]).forEach(targetNS => {
        if(!nsToNSMtlsModes[""][targetNS]) {
          nsToNSMtlsModes[""][targetNS] = {}
        }
        currentLevelPortTlsModes = {}
        allTo3rdPartyNSRules[sourceNS][targetNS].forEach(dr => extractDestinationRuleTlsModes(dr, nsToNSMtlsModes[""][targetNS]))
      })
    })

    Object.keys(allToNSRules).forEach(sourceNS => {
      if(!nsToNSMtlsModes[""]) {
        nsToNSMtlsModes[""] = {}
      }
      if(!nsToNSPriorityMtlsModes[""]) {
        nsToNSPriorityMtlsModes[""] = {}
      }
      Object.keys(allToNSRules[sourceNS]).forEach(targetNS => {
        if(!nsToNSMtlsModes[""][targetNS]) {
          nsToNSMtlsModes[""][targetNS] = {}
        }
        if(!nsToNSPriorityMtlsModes[""][targetNS]) {
          nsToNSPriorityMtlsModes[""][targetNS] = {}
        }
        currentLevelPortTlsModes = {}
        allToNSRules[sourceNS][targetNS].forEach(dr => {
          extractDestinationRuleTlsModes(dr, nsToNSMtlsModes[""][targetNS], nsToNSPriorityMtlsModes[""][targetNS])
        })
      })
    })

    Object.keys(nsToAllRules).forEach(sourceNS => {
      if(!nsToNSMtlsModes[sourceNS]) {
        nsToNSMtlsModes[sourceNS] = {}
      }
      if(!nsToNSPriorityMtlsModes[sourceNS]) {
        nsToNSPriorityMtlsModes[sourceNS] = {}
      }
      nsToNSMtlsModes[sourceNS][""] = {}
      nsToNSPriorityMtlsModes[sourceNS][""] = {}
      currentLevelPortTlsModes = {}
      nsToAllRules[sourceNS].forEach(dr => {
        extractDestinationRuleTlsModes(dr, nsToNSMtlsModes[sourceNS][""], nsToNSPriorityMtlsModes[sourceNS][""])
      })
    })

    Object.keys(nsToNSRules).forEach(sourceNS => {
      if(!nsToNSMtlsModes[sourceNS]) {
        nsToNSMtlsModes[sourceNS] = {}
      }
      if(!nsToNSPriorityMtlsModes[sourceNS]) {
        nsToNSPriorityMtlsModes[sourceNS] = {}
      }
      Object.keys(nsToNSRules[sourceNS]).forEach(targetNS => {
        if(!nsToNSMtlsModes[sourceNS][targetNS]) {
          nsToNSMtlsModes[sourceNS][targetNS] = {}
        }
        if(!nsToNSPriorityMtlsModes[sourceNS][targetNS]) {
          nsToNSPriorityMtlsModes[sourceNS][targetNS] = {}
        }
        currentLevelPortTlsModes = {}
        nsToNSRules[sourceNS][targetNS].forEach(dr => {
          extractDestinationRuleTlsModes(dr, nsToNSMtlsModes[sourceNS][targetNS], nsToNSPriorityMtlsModes[sourceNS][targetNS])
        })
      })
    })

    const nsToServiceMtlsModes = {}

    Object.keys(allTo3rdPartyServiceRules).forEach(sourceNS => {
      Object.keys(allTo3rdPartyServiceRules[sourceNS]).forEach(targetService => {
        const targetNS = targetService.split(".")[1]
        if(!nsToNSPriorityMtlsModes[""] || !nsToNSPriorityMtlsModes[""][targetNS]) {
          if(!nsToServiceMtlsModes[""]) {
            nsToServiceMtlsModes[""] = {}
          }
          if(!nsToServiceMtlsModes[""][targetService]) {
            nsToServiceMtlsModes[""][targetService] = {}
          }
          currentLevelPortTlsModes = {}
          allTo3rdPartyServiceRules[sourceNS][targetService].forEach(dr => extractDestinationRuleTlsModes(dr, nsToServiceMtlsModes[""][targetService]))
        }
      })
    })

    Object.keys(allToServiceRules).forEach(sourceNS => {
      if(!nsToServiceMtlsModes[""]) {
        nsToServiceMtlsModes[""] = {}
      }
      Object.keys(allToServiceRules[sourceNS]).forEach(targetService => {
        if(!nsToServiceMtlsModes[""][targetService]) {
          nsToServiceMtlsModes[""][targetService] = {}
        }
        currentLevelPortTlsModes = {}
        allToServiceRules[sourceNS][targetService].forEach(dr => extractDestinationRuleTlsModes(dr, nsToServiceMtlsModes[""][targetService]))
      })
    })

    Object.keys(nsToServiceRules).forEach(sourceNS => {
      if(!nsToServiceMtlsModes[sourceNS]) {
        nsToServiceMtlsModes[sourceNS] = {}
      }
      Object.keys(nsToServiceRules[sourceNS]).forEach(targetService => {
        if(!nsToServiceMtlsModes[sourceNS][targetService]) {
          nsToServiceMtlsModes[sourceNS][targetService] = {}
        }
        currentLevelPortTlsModes = {}
        nsToServiceRules[sourceNS][targetService].forEach(dr => extractDestinationRuleTlsModes(dr, nsToServiceMtlsModes[sourceNS][targetService]))
      })
    })

    return {
      globalRules,
      allToNSRules,
      allTo3rdPartyNSRules,
      allToServiceRules,
      allTo3rdPartyServiceRules,
      nsToAllRules,
      nsToNSRules,
      nsToServiceRules,
      globalClientMtlsModes,
      nsToNSMtlsModes,
      nsToServiceMtlsModes
    }
  }
  static getServiceMtlsStatus = async (k8sClient: K8sClient, namespace: string, service?: ServiceDetails) => {
    return MtlsUtil.getNamespaceServiceMtlsStatuses(k8sClient, [namespace], service && [service])
  }

  static getServiceMtlsStatuses = async (k8sClient: K8sClient, services: ServiceDetails[]) => {
    const namespaces = services.map(s => s.namespace)
    return MtlsUtil.getNamespaceServiceMtlsStatuses(k8sClient, namespaces, services)
  }

  static getNamespaceServiceMtlsStatuses = async (k8sClient: K8sClient, namespaces: string[], services?: ServiceDetails[]) => {
    const globalMtlsStatus = await MtlsUtil.getGlobalMtlsStatus(k8sClient)
    const {namespacesWithDefaultMtls, servicesWithMtlsPolicies} = 
            await MtlsUtil.getMtlsPolicies(k8sClient)
    const mtlsDestinationRules = await MtlsUtil.getMtlsDestinationRules(k8sClient)

    let serviceMtlsStatus = {}

    for(const namespace of namespaces) {
      serviceMtlsStatus[namespace] = {}
      const namespaceDefaultMtlsMode = namespacesWithDefaultMtls[namespace]
      if(namespaceDefaultMtlsMode) {
        serviceMtlsStatus[namespace]["namespaceDefaultMtlsMode"] = namespaceDefaultMtlsMode
      }
      const isNSDefaultMtlsStrict = namespaceDefaultMtlsMode && namespaceDefaultMtlsMode === 'STRICT'

      const nsServices = services ? services.filter(s => s.namespace === namespace)
                          : (await K8sFunctions.getServices('', namespace, k8sClient)) as ServiceDetails[]
      for(const service of nsServices) {
        const servicePoliciesMtlsStatus = MtlsUtil.getServicePoliciesMtlsStatus(
                service, servicesWithMtlsPolicies, namespaceDefaultMtlsMode, globalMtlsStatus)
        const serviceDestRulesMtlsStatus = MtlsUtil.getServiceDestinationRulesMtlsStatus(service, mtlsDestinationRules)
        
        const podsAndContainers = await K8sFunctions.getPodsAndContainersForService(service, k8sClient)
        const containers = podsAndContainers.containers ? podsAndContainers.containers as any[] : []
        const hasSidecar = containers.filter(c => c === "istio-proxy").length > 0
        const servicePortAccess = {}

        service.ports.forEach(p => {
          const servicePortMtlsModeHasConflict = servicePoliciesMtlsStatus.effectiveServicePortMtlsModes[p.port]
              && servicePoliciesMtlsStatus.effectiveServicePortMtlsModes[p.port].length > 1
          const servicePortMtlsEnabled = hasSidecar 
              && servicePoliciesMtlsStatus.effectiveServicePortMtlsModes[p.port]
              && (servicePoliciesMtlsStatus.effectiveServicePortMtlsModes[p.port].length > 0
                  && servicePoliciesMtlsStatus.effectiveServicePortMtlsModes[p.port][0].length > 0)

          const servicePortMtlsMode = servicePortMtlsEnabled && !servicePortMtlsModeHasConflict &&
                                        servicePoliciesMtlsStatus.effectiveServicePortMtlsModes[p.port][0]
          const servicePortMtlsPermissive = servicePortMtlsMode && 
                  servicePortMtlsMode.toLowerCase() === 'permissive'

          const clientNamespacesWithMtlsConflicts = serviceDestRulesMtlsStatus.servicePortClientNamespaceMtlsConflicts[p.port]
          const effectiveClientModes = serviceDestRulesMtlsStatus.effectiveServicePortClientMtlsModes[p.port]
          const noDestinationRules = Object.keys(effectiveClientModes).length === 0
          const mtlsAccessOnly = servicePortMtlsEnabled && !servicePortMtlsPermissive
          const sidecarAccessNamespaces: any[] = []
          const clientNamespacesInConflictWithMtlsPolicy = {}
          Object.keys(effectiveClientModes)
            .forEach(sourceNS => {
              if(effectiveClientModes[sourceNS].length === 1) {
                const sourceNSMtlsMode = effectiveClientModes[sourceNS][0].mode
                const sourceDR = effectiveClientModes[sourceNS][0].dr
                if((sourceNSMtlsMode === 'DISABLE' && mtlsAccessOnly)
                  || (sourceNSMtlsMode === 'ISTIO_MUTUAL' && !servicePortMtlsEnabled)) {
                  if(!clientNamespacesInConflictWithMtlsPolicy[sourceNS]) {
                    clientNamespacesInConflictWithMtlsPolicy[sourceNS] = []
                  }
                  clientNamespacesInConflictWithMtlsPolicy[sourceNS].push(sourceDR)
                } else if(sourceNSMtlsMode === 'ISTIO_MUTUAL') {
                  sidecarAccessNamespaces.push({namespace: sourceNS, dr: sourceDR})
                }
              } else if(effectiveClientModes[sourceNS].length === 0) {
                if(!servicePortMtlsEnabled || servicePortMtlsPermissive) {
                  sidecarAccessNamespaces.push({namespace: sourceNS})
                }
              }
            })
          const clientHasConflicts = clientNamespacesWithMtlsConflicts.length > 0 
                || Object.keys(clientNamespacesInConflictWithMtlsPolicy).length > 0
          const allAccess = (!servicePortMtlsEnabled || servicePortMtlsPermissive) 
                && (noDestinationRules || !clientHasConflicts)
          const noAccess = mtlsAccessOnly && noDestinationRules
          const nonSidecarOnly = !servicePortMtlsEnabled || (servicePortMtlsPermissive && noDestinationRules)
          const sidecarOnly = servicePortMtlsEnabled && !servicePortMtlsPermissive

          servicePortAccess[p.port] = {
            service: {
              conflict: servicePortMtlsModeHasConflict,
              mtls: servicePortMtlsEnabled,
              permissive: servicePortMtlsPermissive,
              servicePortMtlsMode,
            },
            client: {
              conflict: clientHasConflicts,
              sidecarAccessNamespaces,
              clientNamespacesWithMtlsConflicts,
              clientNamespacesInConflictWithMtlsPolicy,
              noDestinationRules,
              noAccess,
              allAccess,
              sidecarOnly,
              nonSidecarOnly,
            }
          }
        })
        serviceMtlsStatus[namespace][service.name] = {
          hasSidecar,
          servicePoliciesMtlsStatus, 
          serviceDestRulesMtlsStatus, 
          servicePortAccess
        }

      }
    }
    return serviceMtlsStatus
  }

  static getServicePoliciesMtlsStatus(service, servicesWithMtlsPolicies, namespaceDefaultMtlsMode, globalMtlsStatus) {
    let applicablePolicies: any[] = []
    const servicePortPolicies: any[] = []
    servicesWithMtlsPolicies
        .filter(sp => sp.serviceName === service.name && sp.namespace === service.namespace && sp.ports)
        .forEach(sp => {
          applicablePolicies.push(sp.policy)
          sp.ports.forEach(port => {
            servicePortPolicies.push({
              serviceName: sp.serviceName,
              port: port.number || port.name,
              policyName: sp.policyName,
              namespace: sp.namespace,
              mode: sp.mode,
            })
          })
        })
    const servicePolicies = servicesWithMtlsPolicies
            .filter(sp => sp.serviceName === service.name && sp.namespace === service.namespace && !sp.ports)

    servicePolicies.forEach(sp => applicablePolicies.push(sp.policy))

    const servicePortMtlsModes = {}
    servicePortPolicies.forEach(sp => {
      if(!servicePortMtlsModes[sp.port]) {
        servicePortMtlsModes[sp.port] = []
      }
      if(!servicePortMtlsModes[sp.port].includes(sp.mode)) {
        servicePortMtlsModes[sp.port].push(sp.mode)
      }
    })
    const serviceMtlsModes: any[] = []
    servicePolicies.forEach(sp => {
      if(!serviceMtlsModes.includes(sp.mode)) {
        serviceMtlsModes.push(sp.mode)
      }
    })

    const effectiveServicePortMtlsModes = {}
    const defaultServiceMtlsMode = serviceMtlsModes.length > 0 ? serviceMtlsModes : 
                                    [namespaceDefaultMtlsMode || globalMtlsStatus.globalMtlsMode]
    service.ports.forEach(p => {
      effectiveServicePortMtlsModes[p.port] = []
      if(servicePortMtlsModes[p.port] && servicePortMtlsModes[p.port].length > 0) {
        effectiveServicePortMtlsModes[p.port] = effectiveServicePortMtlsModes[p.port].concat(servicePortMtlsModes[p.port])
      }
      if(servicePortMtlsModes[p.name] && servicePortMtlsModes[p.name].length > 0) {
        effectiveServicePortMtlsModes[p.port] = effectiveServicePortMtlsModes[p.port].concat(servicePortMtlsModes[p.name])
      } 
      if(effectiveServicePortMtlsModes[p.port].length === 0) {
        effectiveServicePortMtlsModes[p.port] = defaultServiceMtlsMode
      }
    })
    let servicePoliciesHaveConflict = serviceMtlsModes.length > 1
    Object.keys(effectiveServicePortMtlsModes).forEach(port => {
      servicePoliciesHaveConflict = servicePoliciesHaveConflict || effectiveServicePortMtlsModes[port].length > 1
      if(serviceMtlsModes.length === 1 && effectiveServicePortMtlsModes[port].length === 1) {
        servicePoliciesHaveConflict = servicePoliciesHaveConflict || 
          serviceMtlsModes[0] !== effectiveServicePortMtlsModes[port][0]
      }
    })
    return { 
      servicePoliciesHaveConflict, 
      effectiveServicePortMtlsModes,
      mtlsPolicies: applicablePolicies
    }
  }

  static getServiceDestinationRulesMtlsStatus(service, mtlsDestinationRules) {
    const serviceNS = service.namespace
    const serviceFqdn = service.name+"."+serviceNS+".svc.cluster.local"
    
    let applicableDestinationRules : any[] = []
    applicableDestinationRules = applicableDestinationRules.concat(mtlsDestinationRules.globalRules)

    Object.keys(mtlsDestinationRules.allTo3rdPartyNSRules).forEach(sourceNS => {
      if(mtlsDestinationRules.allTo3rdPartyNSRules[sourceNS][serviceNS]) {
        applicableDestinationRules = applicableDestinationRules.concat(
          mtlsDestinationRules.allTo3rdPartyNSRules[sourceNS][serviceNS])
      }
    })

    Object.keys(mtlsDestinationRules.allTo3rdPartyServiceRules).forEach(sourceNS => {
      if(mtlsDestinationRules.allTo3rdPartyServiceRules[sourceNS][serviceFqdn]) {
        applicableDestinationRules = applicableDestinationRules.concat(
          mtlsDestinationRules.allTo3rdPartyServiceRules[sourceNS][serviceFqdn])
      }
    })

    Object.keys(mtlsDestinationRules.allToNSRules).forEach(sourceNS => {
      if(mtlsDestinationRules.allToNSRules[sourceNS][serviceNS]) {
        applicableDestinationRules = applicableDestinationRules.concat(
          mtlsDestinationRules.allToNSRules[sourceNS][serviceNS])
      }
    })

    Object.keys(mtlsDestinationRules.allToServiceRules).forEach(sourceNS => {
      if(mtlsDestinationRules.allToServiceRules[sourceNS][serviceFqdn]) {
        applicableDestinationRules = applicableDestinationRules.concat(
          mtlsDestinationRules.allToServiceRules[sourceNS][serviceFqdn])
      }
    })

    Object.keys(mtlsDestinationRules.nsToAllRules).forEach(sourceNS => {
      applicableDestinationRules = applicableDestinationRules.concat(
        mtlsDestinationRules.nsToAllRules[sourceNS])
    })

    Object.keys(mtlsDestinationRules.nsToNSRules).forEach(sourceNS => {
      if(mtlsDestinationRules.nsToNSRules[sourceNS][serviceNS]) {
        applicableDestinationRules = applicableDestinationRules.concat(
          mtlsDestinationRules.nsToNSRules[sourceNS][serviceNS])
      }
    })

    Object.keys(mtlsDestinationRules.nsToServiceRules).forEach(sourceNS => {
      if(mtlsDestinationRules.nsToServiceRules[sourceNS][serviceFqdn]) {
        applicableDestinationRules = applicableDestinationRules.concat(
          mtlsDestinationRules.nsToServiceRules[sourceNS][serviceFqdn])
      }
    })

    const effectiveServicePortClientMtlsModes = {}
    service.ports.forEach(p => {
      effectiveServicePortClientMtlsModes[p.port] = {}

      const sourcePortModes = new Set
      mtlsDestinationRules.globalClientMtlsModes[p.port] &&
        mtlsDestinationRules.globalClientMtlsModes[p.port].forEach(data => 
          sourcePortModes.add(data))
      mtlsDestinationRules.globalClientMtlsModes[p.name] &&
        mtlsDestinationRules.globalClientMtlsModes[p.name].forEach(data => 
          sourcePortModes.add(data))
      if(sourcePortModes.size === 0) {
        mtlsDestinationRules.globalClientMtlsModes[""] &&
          mtlsDestinationRules.globalClientMtlsModes[""].forEach(data => 
            sourcePortModes.add(data))
      }
      if(sourcePortModes.size > 0) {
        effectiveServicePortClientMtlsModes[p.port][""] = Array.from(sourcePortModes.values())
      }

      Object.keys(mtlsDestinationRules.nsToNSMtlsModes).forEach(sourceNS => {
        Object.keys(mtlsDestinationRules.nsToNSMtlsModes[sourceNS]).forEach(targetNS => {
          if(targetNS === serviceNS) {
            const sourcePortModes = new Set
            mtlsDestinationRules.nsToNSMtlsModes[sourceNS][targetNS][p.port] && 
              mtlsDestinationRules.nsToNSMtlsModes[sourceNS][targetNS][p.port].forEach(data =>
                sourcePortModes.add(data))

            mtlsDestinationRules.nsToNSMtlsModes[sourceNS][targetNS][p.name] && 
              mtlsDestinationRules.nsToNSMtlsModes[sourceNS][targetNS][p.name].forEach(data =>
                sourcePortModes.add(data))

            if(sourcePortModes.size === 0) {
              mtlsDestinationRules.nsToNSMtlsModes[sourceNS][targetNS][""] &&
                mtlsDestinationRules.nsToNSMtlsModes[sourceNS][targetNS][""].forEach(data => 
                  sourcePortModes.add(data))
            }
            if(sourcePortModes.size > 0) {
              effectiveServicePortClientMtlsModes[p.port][sourceNS] = Array.from(sourcePortModes.values())
            }
          }
        })
      })

      Object.keys(mtlsDestinationRules.nsToServiceMtlsModes).forEach(sourceNS => {
        Object.keys(mtlsDestinationRules.nsToServiceMtlsModes[sourceNS]).forEach(targetService => {
          if(targetService === serviceFqdn) {
            const sourcePortModes = new Set
            mtlsDestinationRules.nsToServiceMtlsModes[sourceNS][targetService][p.port] && 
              mtlsDestinationRules.nsToServiceMtlsModes[sourceNS][targetService][p.port].forEach(data =>
                sourcePortModes.add(data))

            mtlsDestinationRules.nsToServiceMtlsModes[sourceNS][targetService][p.name] && 
              mtlsDestinationRules.nsToServiceMtlsModes[sourceNS][targetService][p.name].forEach(data =>
                sourcePortModes.add(data))

            if(sourcePortModes.size === 0) {
              mtlsDestinationRules.nsToServiceMtlsModes[sourceNS][targetService][""] &&
                mtlsDestinationRules.nsToServiceMtlsModes[sourceNS][targetService][""].forEach(data => 
                  sourcePortModes.add(data))
            }
            if(sourcePortModes.size > 0) {
              effectiveServicePortClientMtlsModes[p.port][sourceNS] = Array.from(sourcePortModes.values())
            }
          }
        })
      })
    })

    const servicePortClientNamespaceMtlsConflicts = {}
    Object.keys(effectiveServicePortClientMtlsModes).forEach(port => {
      servicePortClientNamespaceMtlsConflicts[port] = []
      Object.keys(effectiveServicePortClientMtlsModes[port]).forEach(sourceNS => {
        effectiveServicePortClientMtlsModes[port][sourceNS].length > 1 && 
        servicePortClientNamespaceMtlsConflicts[port].push(sourceNS)
      })
    })

    return {
      servicePortClientNamespaceMtlsConflicts, 
      effectiveServicePortClientMtlsModes, 
      mtlsDestinationRules: applicableDestinationRules
    }
  }

}