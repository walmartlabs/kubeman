/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import JsonUtil from './jsonUtil';

export const isGlobalFqdn = (host) => host && host === "*" 
                            || host === "*.local"
                            || host === "*.cluster.local" 
                            || host === "cluster.local" 
                            || host === "*.svc.cluster.local"
                            || host === "svc.cluster.local"

export const isNamespaceFqdn = (host) => host && host.includes("*") && !isGlobalFqdn(host)

export const isServiceFqdn = (host) => host && !host.includes("*")

export const normalizeServiceFqdn = (host) => 
    host && isServiceFqdn(host) && !host.includes(".svc.cluster.local") ? host+".svc.cluster.local" : host

export const getFqdnFromCluster = (cluster: string) => {
  const parts = cluster.includes("|") ? cluster.split("|") : 
                  cluster.includes("_.") ? cluster.split("_.") : undefined
  return parts && parts.length > 0 ? parts[parts.length-1] : cluster
}

export const getFqdnAndPortFromCluster = (cluster: string) => {
  const parts = cluster.includes("|") ? cluster.split("|") : 
                  cluster.includes("_.") ? cluster.split("_.") : undefined
  return parts && parts.length > 1 ? {fqdn: parts[parts.length-1], port: parts[1]} 
              : {fqdn: cluster}
}

export const extractNamespaceFromFqdn = (fqdn: string) => {
  if(!fqdn) return "*"
  if(fqdn.includes("/")) {
    return fqdn.split("/")[0]
  }
  let namespace = fqdn.replace(".svc.cluster.local", "")
  namespace = namespace.replace("*.cluster.local", "")
  namespace = namespace.replace("*.local", "")
  if(namespace.length === 0 || namespace === "svc.cluster.local" || namespace === "cluster.local") {
    namespace = "*"
  } else {
    const parts = namespace.split(".")
    parts.length > 1 ? namespace = parts[1]
    : parts.length === 1 ? namespace = parts[0]
    : namespace = "*"
  }
  return namespace
}

export const extractServiceFromFqdn = (fqdn) => {
  if(!fqdn) return "*"
  if(fqdn.includes("/")) {
    fqdn = fqdn.split("/")[1]
  }
  if(!fqdn.includes(".")) return fqdn
  let service = fqdn.replace(".svc.cluster.local", "")
  const parts = service.split(".")
  parts.length > 1 ? service = parts[0] : service = "*"
  return service
}

export const areSubsetHosts = (host1, host2) => {
  let result = host1 === "*" || host2 === "*"
  if(!result) {
    host1 = host1.replace("*.", ".").replace("*", "")
    host2 = host2.replace("*.", ".").replace("*", "")
    result = host1.includes(host2) || host2.includes(host1)
  }
  return result
}

export const  matchSubsetHosts = (hosts1, hosts2) => {
  return hosts1.filter(h1 => hosts2.filter(h2 => areSubsetHosts(h1,h2)).length > 0).length > 0
}

export class FqdnMatcher {
  static fqdn: string = ''
  static hasWildcard: boolean = false
  static rootDomain: string = ''
  static subdomain: string = ''
  static namespace: string = ''
  static service: string = ''
  static isStar: boolean = false

  static init(fqdn: string) {
    this.fqdn = fqdn
    this.isStar = fqdn === "*"
    this.hasWildcard = fqdn.includes("*.")
    this.rootDomain = fqdn.replace("*.", "")
    this.subdomain = fqdn.replace("*.", ".")
    this.namespace = extractNamespaceFromFqdn(fqdn)
    this.service = extractServiceFromFqdn(fqdn)
  }

  static initWithService(service: string, namespace: string) {
    this.fqdn = service+"."+namespace
    this.isStar = false
    this.hasWildcard = service === "*."
    this.rootDomain = namespace
    this.subdomain = "."+namespace
    this.namespace = namespace
    this.service = service
  }

  static matchDomain(host: string) {
    if(host) {
      if(this.isStar) return host.includes("*")
      return this.hasWildcard ? 
          host.endsWith(this.subdomain)
          || host.includes(this.subdomain+".")
          || host.includes(this.rootDomain) && host.length === this.rootDomain.length
        : host === this.fqdn 
            || host.endsWith(this.subdomain)
            || host.startsWith(this.rootDomain+".")
    }
    return false
  }

  static matchService(serviceFqdn: string) {
    if(this.isStar) {
      return serviceFqdn.includes("*")
    } else {
      const service = extractServiceFromFqdn(serviceFqdn)
      let namespace: string|undefined = extractNamespaceFromFqdn(serviceFqdn)
      if(namespace === service) {
        namespace = undefined
      }
      return this.service === "*" || service === "*" || 
              this.service === service && (!namespace || this.namespace === namespace)
    }
  }

  static matchNamespace(namespaceFqdn: string) {
    if(this.isStar) {
      return namespaceFqdn.includes("*")
    } else {
      const namespace = extractNamespaceFromFqdn(namespaceFqdn)
      return this.namespace === "*" || namespace === "*" || this.namespace === namespace
    }
  }

  static matchHost(host: string) {
    if(this.isStar) {
      return host.includes("*")
    } else {
      const hostService = extractServiceFromFqdn(host)
      const hostNamespace = extractNamespaceFromFqdn(host)
      return (this.service === "*" || hostService === "*" || this.service === hostService)
            && (this.namespace === "*" || hostNamespace === "*" || this.namespace === hostNamespace)
    }
  }
}


export const matchObjects = (obj1, obj2) => {
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)
  if(keys1.length !== keys2.length) return false
  return keys1.filter(k => obj2[k] && obj2[k] === obj1[k]).length === keys1.length
          && keys2.filter(k => obj1[k] && obj1[k] === obj2[k]).length === keys2.length
}

export const getUniqueResources = (...resourcesLists) => {
  const resources : {[key: string]: any} = {}
  resourcesLists.forEach(list => list.forEach(r => resources[r.name+"."+r.namespace]=r))
  return Object.values(resources)
}

export const getUniqueResourcesByField = (field: string, ...resourcesLists) => {
  const resources : {[key: string]: any} = {}
  resourcesLists.forEach(list => list.forEach(r => resources[JsonUtil.extract(r, field)]=r))
  return Object.values(resources)
}
