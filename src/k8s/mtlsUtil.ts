import _ from 'lodash'
import IstioFunctions from "./istioFunctions";
import { K8sClient } from "./k8sClient";
import K8sFunctions from "./k8sFunctions";
import { ServiceDetails } from "./k8sObjectTypes";
import {isGlobalFqdn, isNamespaceFqdn, isServiceFqdn, normalizeServiceFqdn} from '../util/matchUtil'
import yaml from 'yaml'
import { inherits } from "util";

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
  private static filterMtlsDestinationRules(drules: any[]) {
    return drules.filter(dr => dr.host && dr.trafficPolicy && 
      ( dr.trafficPolicy.tls && dr.trafficPolicy.tls.mode
        || 
        dr.trafficPolicy.portLevelSettings && 
          dr.trafficPolicy.portLevelSettings.filter(p => p.tls).length > 0)
      )
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
    currentLevelPortTlsModes: {},
    map: {},
    map2: {},

    init(map: any, map2?: any) {
      this.currentLevelPortTlsModes = {}
      this.map = map
      this.map2 = map2
    },

    extractDestinationRuleTlsModes(dr) {
      if(dr.trafficPolicy) {
        if(dr.trafficPolicy.tls && dr.trafficPolicy.tls.mode) {
          Object.keys(this.map).forEach(key => {
            if(this.currentLevelPortTlsModes[key]) {
              this.map[key].push({mode: dr.trafficPolicy.tls.mode, dr})
              if(this.map2) {
                this.map2[key] = this.map2[key] || []
                this.map2[key].push(dr.trafficPolicy.tls.mode)
              }
            } else {
              this.currentLevelPortTlsModes[key]=true
              this.map[key] = [{mode: dr.trafficPolicy.tls.mode, dr}]
              this.map2 && (this.map2[key] = [dr.trafficPolicy.tls.mode])
            }
          })
          if(this.currentLevelPortTlsModes[""]) {
            this.map[""].push({mode: dr.trafficPolicy.tls.mode, dr})
            if(this.map2) {
              this.map2[""] = this.map2[""] || []
              this.map2[""].push(dr.trafficPolicy.tls.mode)
            }
          } else {
            this.currentLevelPortTlsModes[""]=true
            this.map[""] = [{mode: dr.trafficPolicy.tls.mode, dr}]
            this.map2 && (this.map2[""] = [dr.trafficPolicy.tls.mode])
          }
        }
        dr.trafficPolicy.portLevelSettings &&
          dr.trafficPolicy.portLevelSettings.forEach(p => {
            if(p.port && p.tls && p.tls.mode) {
              const portId = p.port.number || p.port.name
              if(this.currentLevelPortTlsModes[portId]) {
                this.map[portId].push({mode: p.tls.mode, dr})
                this.map2 && this.map2[portId].push(p.tls.mode)
              } else {
                this.currentLevelPortTlsModes[portId]=true
                this.map[portId] = [{mode: p.tls.mode, dr}]
                this.map2 && (this.map2[portId] = [p.tls.mode])
              }
            }
          })
      }
    }

  }


  static getMtlsModes = (mtlsDestinationRules: any) => {
    const {globalRules, allToNSRules, allToServiceRules, nsToAllRules, nsToNSRules, nsToServiceRules} = mtlsDestinationRules

    const globalClientMtlsModes = {}
    const nsToNSMtlsModes = {"": {}}
    const nsToNSPriorityMtlsModes = {"": {}}
    const nsToServiceMtlsModes = {"": {}}

    MtlsUtil.TlsModeExtractor.init(globalClientMtlsModes)
    globalRules.filter(dr => dr.host === "*")
      .forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))

    MtlsUtil.TlsModeExtractor.init(globalClientMtlsModes)
    globalRules.filter(dr => dr.host === "*.local")
      .forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))

    MtlsUtil.TlsModeExtractor.init(globalClientMtlsModes)
    globalRules.filter(dr => dr.host === "*.cluster.local")
      .forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))

    MtlsUtil.TlsModeExtractor.init(globalClientMtlsModes)
    globalRules.filter(dr => dr.host === "*.svc.cluster.local")
      .forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))


    Object.keys(allToNSRules).forEach(targetNS => {
      if(!nsToNSMtlsModes[""][targetNS]) {
        nsToNSMtlsModes[""][targetNS] = {}
      }
      if(!nsToNSPriorityMtlsModes[""][targetNS]) {
        nsToNSPriorityMtlsModes[""][targetNS] = {}
      }
      MtlsUtil.TlsModeExtractor.init(nsToNSMtlsModes[""][targetNS], nsToNSPriorityMtlsModes[""][targetNS])
      allToNSRules[targetNS].forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))
    })

    Object.keys(nsToAllRules).forEach(sourceNS => {
      if(!nsToNSMtlsModes[sourceNS]) {
        nsToNSMtlsModes[sourceNS] = {}
      }
      if(!nsToNSPriorityMtlsModes[sourceNS]) {
        nsToNSPriorityMtlsModes[sourceNS] = {}
      }
      if(!nsToNSMtlsModes[sourceNS][""]) {
        nsToNSMtlsModes[sourceNS][""] = {}
      }
      if(!nsToNSPriorityMtlsModes[sourceNS][""]) {
        nsToNSPriorityMtlsModes[sourceNS][""] = {}
      }
      MtlsUtil.TlsModeExtractor.init(nsToNSMtlsModes[sourceNS][""], nsToNSPriorityMtlsModes[sourceNS][""])
      nsToAllRules[sourceNS].forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))
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
        MtlsUtil.TlsModeExtractor.init(nsToNSMtlsModes[sourceNS][targetNS], nsToNSPriorityMtlsModes[sourceNS][targetNS])
        nsToNSRules[sourceNS][targetNS].forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))
      })
    })

    Object.keys(allToServiceRules).forEach(targetService => {
      if(!nsToServiceMtlsModes[""][targetService]) {
        nsToServiceMtlsModes[""][targetService] = {}
      }
      MtlsUtil.TlsModeExtractor.init(nsToServiceMtlsModes[""][targetService])
      allToServiceRules[targetService].forEach(dr => MtlsUtil.TlsModeExtractor.extractDestinationRuleTlsModes(dr))
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
    const mtlsModes = MtlsUtil.getMtlsModes(mtlsDestinationRules)

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
        const serviceDestRulesMtlsStatus = MtlsUtil.getServiceDestinationRulesMtlsStatus(service, mtlsDestinationRules, mtlsModes)
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
          let globalClientMtlsMode = effectiveClientModes[""] && effectiveClientModes[""][0].mode
          let clientNSWithMtlsDestRules = 0
          Object.keys(effectiveClientModes)
            .forEach(sourceNS => {
              if(sourceNS !== "") {
                clientNSWithMtlsDestRules++
              }
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
          const allAccess = sidecarAccessNamespaces.length === 0
          const noAccess = mtlsAccessOnly && noDestinationRules
          const nonSidecarOnly = !servicePortMtlsEnabled || (servicePortMtlsPermissive && noDestinationRules)

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

  static getServiceDestinationRulesMtlsStatus(service, mtlsDestinationRules, mtlsModes) {
    const serviceNS = service.namespace
    const serviceFqdn = service.name+"."+serviceNS+".svc.cluster.local"
    
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

    const effectiveServicePortClientMtlsModes = {}
    service.ports.forEach(p => {
      effectiveServicePortClientMtlsModes[p.port] = {}
      const sourcePortModes = new Set
      mtlsModes.globalClientMtlsModes[p.port] &&
        mtlsModes.globalClientMtlsModes[p.port].forEach(data => 
          sourcePortModes.add(data))
      mtlsModes.globalClientMtlsModes[p.name] &&
        mtlsModes.globalClientMtlsModes[p.name].forEach(data => 
          sourcePortModes.add(data))
      if(sourcePortModes.size === 0) {
        mtlsModes.globalClientMtlsModes[""] &&
          mtlsModes.globalClientMtlsModes[""].forEach(data => 
            sourcePortModes.add(data))
      }
      if(sourcePortModes.size > 0) {
        effectiveServicePortClientMtlsModes[p.port][""] = Array.from(sourcePortModes.values())
      }

      Object.keys(mtlsModes.nsToNSMtlsModes).forEach(sourceNS => {
        Object.keys(mtlsModes.nsToNSMtlsModes[sourceNS]).forEach(targetNS => {
          if(targetNS === serviceNS) {
            const sourcePortModes = new Set
            mtlsModes.nsToNSMtlsModes[sourceNS][targetNS][p.port] && 
              mtlsModes.nsToNSMtlsModes[sourceNS][targetNS][p.port].forEach(data =>
                sourcePortModes.add(data))

            mtlsModes.nsToNSMtlsModes[sourceNS][targetNS][p.name] && 
              mtlsModes.nsToNSMtlsModes[sourceNS][targetNS][p.name].forEach(data =>
                sourcePortModes.add(data))

            if(sourcePortModes.size === 0) {
              mtlsModes.nsToNSMtlsModes[sourceNS][targetNS][""] &&
                mtlsModes.nsToNSMtlsModes[sourceNS][targetNS][""].forEach(data => 
                  sourcePortModes.add(data))
            }
            if(sourcePortModes.size > 0) {
              effectiveServicePortClientMtlsModes[p.port][sourceNS] = Array.from(sourcePortModes.values())
            }
          }
        })
      })

      Object.keys(mtlsModes.nsToServiceMtlsModes).forEach(sourceNS => {
        Object.keys(mtlsModes.nsToServiceMtlsModes[sourceNS]).forEach(targetService => {
          if(targetService === serviceFqdn) {
            const sourcePortModes = new Set
            mtlsModes.nsToServiceMtlsModes[sourceNS][targetService][p.port] && 
              mtlsModes.nsToServiceMtlsModes[sourceNS][targetService][p.port].forEach(data =>
                sourcePortModes.add(data))

            mtlsModes.nsToServiceMtlsModes[sourceNS][targetService][p.name] && 
              mtlsModes.nsToServiceMtlsModes[sourceNS][targetService][p.name].forEach(data =>
                sourcePortModes.add(data))

            if(sourcePortModes.size === 0) {
              mtlsModes.nsToServiceMtlsModes[sourceNS][targetService][""] &&
                mtlsModes.nsToServiceMtlsModes[sourceNS][targetService][""].forEach(data => 
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