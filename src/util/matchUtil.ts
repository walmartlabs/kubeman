import _ from 'lodash'

export const isGlobalFqdn = (host) => host && host === "*" || host === "*.local" || host === "*.cluster.local" || host === "*.svc.cluster.local"

export const isNamespaceFqdn = (host) => host && host.includes("*") && !isGlobalFqdn(host)

export const isServiceFqdn = (host) => host && !host.includes("*")

export const areSubsetHosts = (host1, host2) => {
  let result = host1 === "*" || host2 === "*"
  if(!result) {
    host1 = host1.replace("*.", "").replace("*", "")
    host2 = host2.replace("*.", "").replace("*", "")
    result = host1.includes(host2) || host2.includes(host1)
  }
  return result
}

export const  matchSubsetHosts = (hosts1, hosts2) => {
  return hosts1.filter(h1 => hosts2.filter(h2 => areSubsetHosts(h1,h2)).length > 0).length > 0
}

export const matchObjects = (obj1, obj2) => {
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)
  if(keys1.length !== keys2.length) return false
  return keys1.filter(k => obj2[k] && obj2[k] === obj1[k]).length === keys1.length
          && keys2.filter(k => obj1[k] && obj1[k] === obj2[k]).length === keys2.length
}
