import _ from 'lodash'

export const isGlobalFqdn = (host) => host && host === "*" 
                            || host === "*.local"
                            || host === "*.cluster.local" 
                            || host === "cluster.local" 
                            || host === "*.svc.cluster.local"
                            || host === "svc.cluster.local"

export const isNamespaceFqdn = (host) => host && host.includes("*") && !isGlobalFqdn(host)

export const isServiceFqdn = (host) => host && !host.includes("*")

export const extractNamespaceFromFqdn = (fqdn) => {
  if(!fqdn) return "*"
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
  private static fqdn: string = ''
  private static hasWildcard: boolean = false
  private static rootDomain: string = ''
  private static subdomain: string = ''
  private static lastChar: string = ''
  private static namespace: string = ''
  private static service: string = ''
  private static isStar: boolean = false

  static init(fqdn: string) {
    this.fqdn = fqdn
    this.isStar = fqdn === "*"
    this.hasWildcard = fqdn.includes("*.")
    this.rootDomain = fqdn.replace("*.", "")
    this.subdomain = fqdn.replace("*.", ".")
    this.lastChar = fqdn.slice(fqdn.length-1)
    this.namespace = extractNamespaceFromFqdn(fqdn)
    this.service = extractServiceFromFqdn(fqdn)
  }

  static initWithService(service: string, namespace: string) {
    this.fqdn = service+"."+namespace
    this.isStar = false
    this.hasWildcard = service === "*."
    this.rootDomain = namespace
    this.subdomain = "."+namespace
    this.lastChar = namespace.slice(namespace.length-1)
    this.namespace = namespace
    this.service = service
  }

  static matchDomain(host: string) {
    if(host) {
      if(this.isStar) return host.includes("*")
      return this.hasWildcard ? 
        (host.includes(this.subdomain) && host.lastIndexOf(this.lastChar) === host.length-1) 
          || host.includes(this.rootDomain) && host.length === this.rootDomain.length
        : host === this.fqdn || (host.includes("."+this.fqdn) && host.lastIndexOf(this.lastChar) === host.length-1)
    }
    return false
  }

  static matchService(serviceFqdn: string) {
    if(this.isStar) {
      return serviceFqdn.includes("*")
    } else {
      const service = extractServiceFromFqdn(serviceFqdn)
      return this.service === "*" || service === "*" || this.service === service
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
