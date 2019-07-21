/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import IstioFunctions from "./istioFunctions";
import { K8sClient } from "./k8sClient";
import K8sFunctions from "./k8sFunctions";
import { ServiceDetails } from "./k8sObjectTypes";
import {isGlobalFqdn, isNamespaceFqdn, isServiceFqdn, normalizeServiceFqdn, FqdnMatcher} from '../util/matchUtil'
import yaml from 'yaml'
import { inherits } from "util";

export enum ServiceMtlsMode {
  DISABLE = "DISABLE", 
  STRICT = "STRICT", 
  PERMISSIVE = "PERMISSIVE"
}

export enum ClientMtlsMode {
  NONE = "NONE", 
  DISABLE = "DISABLE", 
  ISTIO_MUTUAL = "ISTIO_MUTUAL"
}

export interface GlobalMtlsStatus {
  isGlobalMtlsEnabled: boolean
  isGlobalMtlsPermissive: boolean
  globalMtlsMode: ServiceMtlsMode
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
    let globalMtlsMode = ServiceMtlsMode.DISABLE
    const defaultMeshPolicy = (await IstioFunctions.listAllMeshPolicies(k8sClient))
            .filter(policy => policy.name === 'default')[0]
    if(defaultMeshPolicy) {
      const meshPolicyMtls = defaultMeshPolicy.peers.filter(p => p.mtls).map(p => p.mtls)[0]
      meshPolicyMtls && (globalMtlsMode = meshPolicyMtls.mode ? meshPolicyMtls.mode.toUpperCase() : ServiceMtlsMode.STRICT)
    }
    return {
      isGlobalMtlsEnabled: globalMtlsMode !== ServiceMtlsMode.DISABLE,
      isGlobalMtlsPermissive: globalMtlsMode === ServiceMtlsMode.PERMISSIVE,
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
        .filter(policy => policy.name === 'default' && !policy.targets && policy.peers && 
                          (policy.peers.length === 0 || policy.peers.filter(peer => peer.mtls).length > 0))
        .forEach(policy => {
          namespaceDefaultMtlsPolicies[policy.namespace] = policy
          const peerMtls = policy.peers.filter(peer => peer.mtls).map(peer => peer.mtls)[0]
          namespacesWithDefaultMtls[policy.namespace] = peerMtls && peerMtls.mode ? peerMtls.mode.toUpperCase() : ServiceMtlsMode.DISABLE
        })

      policies.filter(policy => policy.name !== 'default' &&
                      policy.peers && policy.peers.filter(peer => peer.mtls).length > 0
                      && policy.targets && policy.targets.length > 0)

        .forEach(policy => policy.targets.forEach(target => {
          const peerMtls = policy.peers.filter(peer => peer.mtls).map(peer => peer.mtls)[0]
          servicesWithMtlsPolicies.push({
                serviceName: target.name,
                ports: target.ports,
                policyName: policy.name,
                namespace: policy.namespace,
                peers: policy.peers,
                mode: peerMtls && peerMtls.mode ? peerMtls.mode.toUpperCase() : ServiceMtlsMode.DISABLE,
                policy
          })
        }))
    }


    return {
      namespacesWithDefaultMtls,
      namespaceDefaultMtlsPolicies,
      servicesWithMtlsPolicies
    }
  }
  private static filterMtlsDestinationRules(drules: any[]) {
    return drules.filter(dr => dr.host && dr.trafficPolicy)
    .filter(dr => {
      if(dr.trafficPolicy.tls && dr.trafficPolicy.tls.mode || 
        dr.trafficPolicy.portLevelSettings && 
          dr.trafficPolicy.portLevelSettings.filter(p => p.tls).length > 0) {
            return true
      } else {
        dr.trafficPolicy = (dr.trafficPolicy || {})
        dr.trafficPolicy.tls = (dr.trafficPolicy.tls || {})
        dr.trafficPolicy.tls.mode = 'DISABLE'
        dr.trafficPolicy.tls.note = "** DR missing TLS mode, defaults to DISABLE **"
        return true
      }
    })
  }

  private static async filterGlobalMtlsDestinationRules(drules: any[], configNamespace: string) {
    return drules.filter(dr => dr.namespace === configNamespace && 
                      (!dr.exportTo || dr.exportTo.includes("*")))
  }

  private static async filterNonGlobalMtlsDestinationRules(drules: any[], configNamespace: string) {
    return drules.filter(dr => dr.namespace !== configNamespace && (!dr.exportTo || dr.exportTo.includes("*")))
  }

  static getMtlsDestinationRules = async (k8sClient: K8sClient) => {
    const mtlsDestinationRules = MtlsUtil.filterMtlsDestinationRules(
      IstioFunctions.extractDestinationRules(await k8sClient.istio.destinationrules.get()))

    mtlsDestinationRules.forEach(dr => {
      dr.data = {}
      dr.data.isTargetGlobal = isGlobalFqdn(dr.host)
      dr.data.isTargetNamespace = isNamespaceFqdn(dr.host)
      dr.data.isTargetService = isServiceFqdn(dr.host)
      dr.data.targetService = dr.data.isTargetService ? normalizeServiceFqdn(dr.host) : undefined
      dr.data.targetNamespace = (dr.data.isTargetNamespace || dr.data.targetService) && dr.host.split(".")[1]
      dr.data.sourceNamespace = dr.namespace
      dr.data.targetSelf = dr.namespace === dr.data.targetNamespace
    })

    const istioConfigMap = await K8sFunctions.getNamespaceConfigMap("istio", "istio-system", k8sClient)
    const configNamespace = istioConfigMap ? yaml.parse(istioConfigMap.data.mesh).rootNamespace : "istio-system"
    
    const allGlobalRules = await MtlsUtil.filterGlobalMtlsDestinationRules(mtlsDestinationRules, configNamespace)
    const allNonGlobalRules = await MtlsUtil.filterNonGlobalMtlsDestinationRules(mtlsDestinationRules, configNamespace)

    const globalRules : any[] = []
    const allToNSRules = {}
    const allToServiceRules = {}
    const nsToAllRules = {}
    const nsToNSRules = {}
    const nsToServiceRules = {}

    //Global rules have lowest priority
    allGlobalRules.forEach(dr => {
      if(dr.data.isTargetGlobal) {
        globalRules.push(dr)
      } else if(dr.data.isTargetNamespace) {
        allToNSRules[dr.data.targetNamespace] = allToNSRules[dr.data.targetNamespace] || []
        allToNSRules[dr.data.targetNamespace].push(dr)
      } else if(dr.data.isTargetService) {
        allToServiceRules[dr.data.targetService] = allToServiceRules[dr.data.targetService] || []
        allToServiceRules[dr.data.targetService].push(dr)
      }
      delete dr.data
    })

    //Service namespace rules have medium priority
    allNonGlobalRules.forEach(dr => {
      const sourceNS = dr.data.sourceNamespace
      const targetNS = dr.data.targetNamespace
      
      if(dr.data.isTargetGlobal) {
        nsToAllRules[sourceNS] = nsToAllRules[sourceNS] || []
        nsToAllRules[sourceNS].push(dr)
        //An NSToAll rule is also an AllToNS rule
        allToNSRules[sourceNS] = allToNSRules[sourceNS] || []
        allToNSRules[sourceNS].push(dr)
      } else if(dr.data.isTargetNamespace) {
        nsToNSRules[sourceNS] = nsToNSRules[sourceNS] || {}
        nsToNSRules[sourceNS][targetNS] = nsToNSRules[sourceNS][targetNS] || []
        nsToNSRules[sourceNS][targetNS].push(dr)
        if(sourceNS === targetNS) {
          allToNSRules[targetNS] = allToNSRules[targetNS] || []
          allToNSRules[targetNS].push(dr)
        }
      } else if(dr.data.isTargetService) {
        nsToServiceRules[sourceNS] = nsToServiceRules[sourceNS] || {}
        nsToServiceRules[sourceNS][dr.data.targetService] = nsToServiceRules[sourceNS][dr.data.targetService] || []
        nsToServiceRules[sourceNS][dr.data.targetService].push(dr)
        if(sourceNS === targetNS) {
          allToServiceRules[dr.data.targetService] = allToServiceRules[dr.data.targetService] || []
          allToServiceRules[dr.data.targetService].push(dr)
        }
      } 
      delete dr.data
    })
    return {
      globalRules,
      allToNSRules,
      allToServiceRules,
      nsToAllRules,
      nsToNSRules,
      nsToServiceRules
    }
  }

  static TlsModeExtractor = {
    currentLevelPortTlsModes: {}, //used to reset a port's tls config if seen at a higher priority level
    map: {},

    init(map: any) {
      this.currentLevelPortTlsModes = {}
      this.map = map
    },

    extractDestinationRuleTlsModes(dr) {
      if(dr.trafficPolicy) {
        if(dr.trafficPolicy.tls && dr.trafficPolicy.tls.mode) {
          Object.keys(this.map).forEach(key => {
            if(this.currentLevelPortTlsModes[key]) {
              this.map[key].push({mode: dr.trafficPolicy.tls.mode, dr})
            } else {
              this.currentLevelPortTlsModes[key]=true
              this.map[key] = [{mode: dr.trafficPolicy.tls.mode, dr}]
            }
          })
          if(this.currentLevelPortTlsModes[""]) {
            this.map[""].push({mode: dr.trafficPolicy.tls.mode, dr})
          } else {
            this.currentLevelPortTlsModes[""]=true
            this.map[""] = [{mode: dr.trafficPolicy.tls.mode, dr}]
          }
        }
        dr.trafficPolicy.portLevelSettings &&
          dr.trafficPolicy.portLevelSettings.forEach(p => {
            if(p.port && p.tls && p.tls.mode) {
              const portId = p.port.number || p.port.name
              if(this.currentLevelPortTlsModes[portId]) {
                this.map[portId].push({mode: p.tls.mode, dr})
              } else {
                this.currentLevelPortTlsModes[portId]=true
                this.map[portId] = [{mode: p.tls.mode, dr}]
              }
            }
          })
      }
    }

  }


  static getMtlsModes = (mtlsDestinationRules: any) => {
    const {globalRules, allToNSRules, allToServiceRules, nsToAllRules, nsToNSRules, nsToServiceRules} = mtlsDestinationRules

    //maps from NS/Service to ports to array of tls modes
    const allToAllMtlsModes = {}
    const allToNSMtlsModes = {}
    const nsToAllMtlsModes = {}
    const nsToNSMtlsModes = {}
    const allToServiceMtlsModes = {}
    const nsToServiceMtlsModes = {"": {}}

    MtlsUtil.TlsModeExtractor.init(allToAllMtlsModes)
    globalRules.filter(dr => dr.host === "*")
      .forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))

    MtlsUtil.TlsModeExtractor.init(allToAllMtlsModes)
    globalRules.filter(dr => dr.host === "*.local")
      .forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))

    MtlsUtil.TlsModeExtractor.init(allToAllMtlsModes)
    globalRules.filter(dr => dr.host === "*.cluster.local")
      .forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))

    MtlsUtil.TlsModeExtractor.init(allToAllMtlsModes)
    globalRules.filter(dr => dr.host === "*.svc.cluster.local")
      .forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))


    Object.keys(allToNSRules).forEach(targetNS => {
      if(!allToNSMtlsModes[targetNS]) {
        allToNSMtlsModes[targetNS] = {}
      }
      MtlsUtil.TlsModeExtractor.init(allToNSMtlsModes[targetNS])
      allToNSRules[targetNS].forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))
    })

    Object.keys(allToServiceRules).forEach(targetService => {
      if(!allToServiceMtlsModes[targetService]) {
        allToServiceMtlsModes[targetService] = {}
      }
      MtlsUtil.TlsModeExtractor.init(allToServiceMtlsModes[targetService])
      allToServiceRules[targetService].forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))
    })

    Object.keys(nsToAllRules).forEach(sourceNS => {
      if(!nsToAllMtlsModes[sourceNS]) {
        nsToAllMtlsModes[sourceNS] = {}
      }
      MtlsUtil.TlsModeExtractor.init(nsToAllMtlsModes[sourceNS])
      nsToAllRules[sourceNS].forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))
    })

    Object.keys(nsToNSRules).forEach(sourceNS => {
      if(!nsToNSMtlsModes[sourceNS]) {
        nsToNSMtlsModes[sourceNS] = {}
      }
      Object.keys(nsToNSRules[sourceNS]).forEach(targetNS => {
        if(!nsToNSMtlsModes[sourceNS][targetNS]) {
          nsToNSMtlsModes[sourceNS][targetNS] = {}
        }
        MtlsUtil.TlsModeExtractor.init(nsToNSMtlsModes[sourceNS][targetNS])
        nsToNSRules[sourceNS][targetNS].forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))
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
        MtlsUtil.TlsModeExtractor.init(nsToServiceMtlsModes[sourceNS][targetService])
        nsToServiceRules[sourceNS][targetService].forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))
      })
    })
    return {
      allToAllMtlsModes,
      allToNSMtlsModes,
      allToServiceMtlsModes,
      nsToAllMtlsModes,
      nsToNSMtlsModes,
      nsToServiceMtlsModes
    }
  }

  static getServiceMtlsStatus = async (k8sClient: K8sClient, namespace: string, service?: ServiceDetails) => {
    return (await MtlsUtil.getNamespaceServiceMtlsStatuses(k8sClient, [namespace], service && [service]))[namespace]
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
    const mtlsModes = MtlsUtil.getMtlsModes(mtlsDestinationRules)

    let serviceMtlsStatus = {}

    for(const namespace of namespaces) {
      serviceMtlsStatus[namespace] = {}
      const namespaceDefaultMtlsMode = namespacesWithDefaultMtls[namespace]
      if(namespaceDefaultMtlsMode) {
        serviceMtlsStatus[namespace]["namespaceDefaultMtlsMode"] = namespaceDefaultMtlsMode
      }
      const nsServices = services ? services.filter(s => s.namespace === namespace)
                          : (await K8sFunctions.getServicesWithDetails(namespace, k8sClient)) as ServiceDetails[]
      for(const service of nsServices) {
        const servicePoliciesMtlsStatus = MtlsUtil.getServicePoliciesMtlsStatus(
                service, servicesWithMtlsPolicies, namespaceDefaultMtlsMode, globalMtlsStatus)
        const effectiveServicePortClientMtlsModes = MtlsUtil.getClientMtlsModeForServicePorts(service, mtlsModes)
        const servicePortClientNamespaceMtlsConflicts = MtlsUtil.getClientMtlsConflicsForServicePorts(effectiveServicePortClientMtlsModes)
        const servicePortDefaultMtlsDestinationRuleStatus = MtlsUtil.getDefaultDestinationRulesMtlsStatusForServicePorts(effectiveServicePortClientMtlsModes)
        const applicableDestinationRules = MtlsUtil.getApplicableDestinationRules(service, mtlsDestinationRules)
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
                  && servicePoliciesMtlsStatus.effectiveServicePortMtlsModes[p.port][0].length > 0
                  && servicePoliciesMtlsStatus.effectiveServicePortMtlsModes[p.port][0] !== ServiceMtlsMode.DISABLE)

          const servicePortMtlsMode = servicePortMtlsEnabled && !servicePortMtlsModeHasConflict &&
                                        servicePoliciesMtlsStatus.effectiveServicePortMtlsModes[p.port][0]
          const servicePortMtlsPermissive = servicePortMtlsEnabled && servicePortMtlsMode === ServiceMtlsMode.PERMISSIVE 

          const clientNamespacesWithMtlsConflicts = servicePortClientNamespaceMtlsConflicts[p.port]
          const effectiveClientModes = effectiveServicePortClientMtlsModes[p.port]
          const noDestinationRules = Object.keys(effectiveClientModes).length === 0
          const mtlsAccessOnly = servicePortMtlsEnabled && !servicePortMtlsPermissive
          const sidecarAccessNamespaces: any[] = []
          const clientNamespacesInConflictWithMtlsPolicy = {}
          Object.keys(effectiveClientModes).forEach(sourceNS => {
              if(effectiveClientModes[sourceNS].length === 1) {
                const sourceNSMtlsMode = effectiveClientModes[sourceNS][0].mode
                const sourceDR = effectiveClientModes[sourceNS][0].dr
                if((sourceNSMtlsMode === ClientMtlsMode.DISABLE && mtlsAccessOnly)
                  || (sourceNSMtlsMode === ClientMtlsMode.ISTIO_MUTUAL && !servicePortMtlsEnabled)) {
                  if(!clientNamespacesInConflictWithMtlsPolicy[sourceNS]) {
                    clientNamespacesInConflictWithMtlsPolicy[sourceNS] = []
                  }
                  clientNamespacesInConflictWithMtlsPolicy[sourceNS].push(sourceDR)
                } else if(sourceNSMtlsMode === ClientMtlsMode.ISTIO_MUTUAL) {
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
          const allAccess = !servicePortMtlsEnabled || servicePortMtlsPermissive
          const noAccess = mtlsAccessOnly && noDestinationRules
          const portDefaultMtlsDestinationRuleStatus = servicePortDefaultMtlsDestinationRuleStatus[p.port]
          const nonSidecarOnly = !servicePortMtlsEnabled && portDefaultMtlsDestinationRuleStatus
                && portDefaultMtlsDestinationRuleStatus.onlyDefaultMtlsDestinationRuleDefined
                && portDefaultMtlsDestinationRuleStatus.defaultDestinationRuleMtlsMode === ClientMtlsMode.ISTIO_MUTUAL


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
              sidecarOnly: mtlsAccessOnly,
              nonSidecarOnly,
            }
          }
        })
        serviceMtlsStatus[namespace][service.name] = {
          hasSidecar,
          mtlsPolicies: servicePoliciesMtlsStatus.mtlsPolicies,
          effectiveServicePortMtlsModes:  servicePoliciesMtlsStatus.effectiveServicePortMtlsModes,
          mtlsDestinationRules: applicableDestinationRules,
          effectiveServicePortClientMtlsModes,
          servicePortDefaultMtlsDestinationRuleStatus,
          servicePortClientNamespaceMtlsConflicts,
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

  static getApplicableDestinationRules(service, mtlsDestinationRules) {
    const serviceNS = service.namespace
    const serviceFqdn = service.name+"."+serviceNS+".svc.cluster.local"
    FqdnMatcher.initWithService(service.name, serviceNS)
    
    let applicableDestinationRules : any[] = []
    applicableDestinationRules = applicableDestinationRules.concat(mtlsDestinationRules.globalRules)
    if(mtlsDestinationRules.allToNSRules[serviceNS]) {
      applicableDestinationRules = applicableDestinationRules.concat(
        mtlsDestinationRules.allToNSRules[serviceNS])
    }
    if(mtlsDestinationRules.allToServiceRules[serviceFqdn]) {
      applicableDestinationRules = applicableDestinationRules.concat(
        mtlsDestinationRules.allToServiceRules[serviceFqdn])
    }

    Object.keys(mtlsDestinationRules.nsToAllRules).forEach(sourceNS => {
      applicableDestinationRules = applicableDestinationRules.concat(
        mtlsDestinationRules.nsToAllRules[sourceNS])
    })
    if(mtlsDestinationRules.nsToNSRules[serviceNS]) {
      Object.keys(mtlsDestinationRules.nsToNSRules[serviceNS]).forEach(targetNS => {
        applicableDestinationRules = applicableDestinationRules.concat(
          mtlsDestinationRules.nsToNSRules[serviceNS][targetNS])
      })
    }
    Object.keys(mtlsDestinationRules.nsToNSRules).forEach(sourceNS => {
      if(mtlsDestinationRules.nsToNSRules[sourceNS][serviceNS]) {
        applicableDestinationRules = applicableDestinationRules.concat(
          mtlsDestinationRules.nsToNSRules[sourceNS][serviceNS])
      }
    })
    if(mtlsDestinationRules.nsToServiceRules[serviceNS]) {
      Object.keys(mtlsDestinationRules.nsToServiceRules[serviceNS]).forEach(targetService => {
        applicableDestinationRules = applicableDestinationRules.concat(
          mtlsDestinationRules.nsToServiceRules[serviceNS][targetService])
      })
    }
    Object.keys(mtlsDestinationRules.nsToServiceRules).forEach(sourceNS => {
      if(mtlsDestinationRules.nsToServiceRules[sourceNS][serviceFqdn]) {
        applicableDestinationRules = applicableDestinationRules.concat(
          mtlsDestinationRules.nsToServiceRules[sourceNS][serviceFqdn])
      }
    })
    applicableDestinationRules = _.uniqBy(applicableDestinationRules, dr => dr.name+"."+dr.namespace)

    return applicableDestinationRules
  }

  static getClientMtlsModeForServicePorts(service, mtlsModes) {
    const serviceNS = service.namespace
    FqdnMatcher.initWithService(service.name, serviceNS)

    const effectiveServicePortClientMtlsModes = {}
    service.ports.forEach(p => {
      effectiveServicePortClientMtlsModes[p.port] = {}
      const sourcePortModes = new Set
      mtlsModes.allToAllMtlsModes[p.port] &&
        mtlsModes.allToAllMtlsModes[p.port].forEach(data => sourcePortModes.add(data))

      mtlsModes.allToAllMtlsModes[p.name] &&
        mtlsModes.allToAllMtlsModes[p.name].forEach(data =>  sourcePortModes.add(data))

      if(sourcePortModes.size === 0) { //specific port data not found, use default port data
        mtlsModes.allToAllMtlsModes[""] &&
          mtlsModes.allToAllMtlsModes[""].forEach(data =>  sourcePortModes.add(data))
      }
      if(sourcePortModes.size > 0) {
        effectiveServicePortClientMtlsModes[p.port][""] = Array.from(sourcePortModes.values())
      }

      Object.keys(mtlsModes.allToNSMtlsModes).forEach(targetNS => {
        if(targetNS === serviceNS) {
          const sourcePortModes = new Set
          mtlsModes.allToNSMtlsModes[targetNS][p.port] && 
            mtlsModes.allToNSMtlsModes[targetNS][p.port].forEach(data => sourcePortModes.add(data))

          mtlsModes.allToNSMtlsModes[targetNS][p.name] && 
            mtlsModes.allToNSMtlsModes[targetNS][p.name].forEach(data => sourcePortModes.add(data))

          if(sourcePortModes.size === 0) {
            mtlsModes.allToNSMtlsModes[targetNS][""] &&
              mtlsModes.allToNSMtlsModes[targetNS][""].forEach(data => sourcePortModes.add(data))
          }
          if(sourcePortModes.size > 0) {
            effectiveServicePortClientMtlsModes[p.port][""] = Array.from(sourcePortModes.values())
          }
        }
      })

      Object.keys(mtlsModes.allToServiceMtlsModes).forEach(targetService => {
        if(FqdnMatcher.matchService(targetService)) {
          const sourcePortModes = new Set
          mtlsModes.allToServiceMtlsModes[targetService][p.port] && 
            mtlsModes.allToServiceMtlsModes[targetService][p.port].forEach(data => sourcePortModes.add(data))

          mtlsModes.allToServiceMtlsModes[targetService][p.name] && 
            mtlsModes.allToServiceMtlsModes[targetService][p.name].forEach(data => sourcePortModes.add(data))

          if(sourcePortModes.size === 0) {
            mtlsModes.allToServiceMtlsModes[targetService][""] &&
              mtlsModes.allToServiceMtlsModes[targetService][""].forEach(data => sourcePortModes.add(data))
          }
          if(sourcePortModes.size > 0) {
            effectiveServicePortClientMtlsModes[p.port][""] = Array.from(sourcePortModes.values())
          }
        }
      })

      Object.keys(mtlsModes.nsToAllMtlsModes).forEach(sourceNS => {
        const sourcePortModes = new Set
        mtlsModes.nsToAllMtlsModes[sourceNS][p.port] && 
          mtlsModes.nsToAllMtlsModes[sourceNS][p.port].forEach(data => sourcePortModes.add(data))

        mtlsModes.nsToAllMtlsModes[sourceNS][p.name] && 
          mtlsModes.nsToAllMtlsModes[sourceNS][p.name].forEach(data => sourcePortModes.add(data))

        if(sourcePortModes.size === 0) {
          mtlsModes.nsToAllMtlsModes[sourceNS][""] &&
            mtlsModes.nsToAllMtlsModes[sourceNS][""].forEach(data => sourcePortModes.add(data))
        }
        if(sourcePortModes.size > 0) {
          effectiveServicePortClientMtlsModes[p.port][sourceNS] = Array.from(sourcePortModes.values())
        }
      })

      Object.keys(mtlsModes.nsToNSMtlsModes).forEach(sourceNS => {
        Object.keys(mtlsModes.nsToNSMtlsModes[sourceNS]).forEach(targetNS => {
          if(targetNS === serviceNS) {
            const sourcePortModes = new Set
            mtlsModes.nsToNSMtlsModes[sourceNS][targetNS][p.port] && 
              mtlsModes.nsToNSMtlsModes[sourceNS][targetNS][p.port].forEach(data => sourcePortModes.add(data))

            mtlsModes.nsToNSMtlsModes[sourceNS][targetNS][p.name] && 
              mtlsModes.nsToNSMtlsModes[sourceNS][targetNS][p.name].forEach(data => sourcePortModes.add(data))

            if(sourcePortModes.size === 0) {
              mtlsModes.nsToNSMtlsModes[sourceNS][targetNS][""] &&
                mtlsModes.nsToNSMtlsModes[sourceNS][targetNS][""].forEach(data => sourcePortModes.add(data))
            }
            if(sourcePortModes.size > 0) {
              effectiveServicePortClientMtlsModes[p.port][sourceNS] = Array.from(sourcePortModes.values())
            }
          }
        })
      })

      Object.keys(mtlsModes.nsToServiceMtlsModes).forEach(sourceNS => {
        Object.keys(mtlsModes.nsToServiceMtlsModes[sourceNS]).forEach(targetService => {
          if(FqdnMatcher.matchService(targetService)) {
            const sourcePortModes = new Set
            mtlsModes.nsToServiceMtlsModes[sourceNS][targetService][p.port] && 
              mtlsModes.nsToServiceMtlsModes[sourceNS][targetService][p.port].forEach(data => sourcePortModes.add(data))

            mtlsModes.nsToServiceMtlsModes[sourceNS][targetService][p.name] && 
              mtlsModes.nsToServiceMtlsModes[sourceNS][targetService][p.name].forEach(data => sourcePortModes.add(data))

            if(sourcePortModes.size === 0) {
              mtlsModes.nsToServiceMtlsModes[sourceNS][targetService][""] &&
                mtlsModes.nsToServiceMtlsModes[sourceNS][targetService][""].forEach(data => sourcePortModes.add(data))
            }
            if(sourcePortModes.size > 0) {
              effectiveServicePortClientMtlsModes[p.port][sourceNS] = Array.from(sourcePortModes.values())
            }
          }
        })
      })
    })

    return effectiveServicePortClientMtlsModes
  }

  static getClientMtlsConflicsForServicePorts(effectiveServicePortClientMtlsModes) {
    const servicePortClientNamespaceMtlsConflicts = {}
    Object.keys(effectiveServicePortClientMtlsModes).forEach(port => {
      servicePortClientNamespaceMtlsConflicts[port] = []
      const portSourceNamespaces = Object.keys(effectiveServicePortClientMtlsModes[port])
      portSourceNamespaces.forEach(sourceNS => {
        effectiveServicePortClientMtlsModes[port][sourceNS].length > 1 && 
        servicePortClientNamespaceMtlsConflicts[port].push(sourceNS)
      })
    })

    return servicePortClientNamespaceMtlsConflicts
  }

  static getDefaultDestinationRulesMtlsStatusForServicePorts(effectiveServicePortClientMtlsModes) {
    const servicePortDefaultMtlsDestinationRuleStatus = {}
    Object.keys(effectiveServicePortClientMtlsModes).forEach(port => {
      const portSourceNamespaces = Object.keys(effectiveServicePortClientMtlsModes[port])
      servicePortDefaultMtlsDestinationRuleStatus[port] = {}
      servicePortDefaultMtlsDestinationRuleStatus[port].defaultMtlsDestinationRuleDefined = 
          effectiveServicePortClientMtlsModes[port][""] && effectiveServicePortClientMtlsModes[port][""].length > 0
      servicePortDefaultMtlsDestinationRuleStatus[port].defaultDestinationRuleMtlsMode = 
          effectiveServicePortClientMtlsModes[port][""] && effectiveServicePortClientMtlsModes[port][""].length === 1 ?
            effectiveServicePortClientMtlsModes[port][""][0] : undefined
      servicePortDefaultMtlsDestinationRuleStatus[port].onlyDefaultMtlsDestinationRuleDefined = 
          servicePortDefaultMtlsDestinationRuleStatus[port].defaultMtlsDestinationRuleDefined && portSourceNamespaces.length === 1
    })

    return servicePortDefaultMtlsDestinationRuleStatus
  }

}