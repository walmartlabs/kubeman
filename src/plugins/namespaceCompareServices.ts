import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'


export function generateServiceComparisonOutput(clusters, namespaces, clusterServices) {
  const output: ActionOutput = []
  const headers: string[] = ["Namespace/Service"]
  clusters.forEach(cluster => {
    headers.push("Cluster: " + cluster.name)
  })
  output.push(headers)

  const nsServiceToClusterMap = {}
  namespaces.forEach(ns => {
    const namespace = ns.name
    if(!nsServiceToClusterMap[namespace]) {
      nsServiceToClusterMap[namespace] = {}
    }
    Object.keys(clusterServices).forEach(cluster => {
      const clusterNSServices = clusterServices[cluster][namespace]
      clusterNSServices && 
        clusterNSServices.forEach(service => {
          if(!nsServiceToClusterMap[namespace][service]) {
            nsServiceToClusterMap[namespace][service] = {}
          }
          nsServiceToClusterMap[namespace][service][cluster] = true
        })
    })
  })

  Object.keys(nsServiceToClusterMap).forEach(namespace => {
    const groupTitle = [">Namespace: " + namespace]
    clusters.forEach(cluster => {
      groupTitle.push("")
    })
    output.push(groupTitle)
    const serviceToClusterMap = nsServiceToClusterMap[namespace]
    const services = serviceToClusterMap ? Object.keys(serviceToClusterMap) : []
    if(services.length === 0) {
      output.push(["No Services", ...clusters.map(() => "")])
    } else {
      services.forEach(service => {
        const clusterMap = serviceToClusterMap[service]
        const row = [service]
        clusters.forEach(cluster => {
          row.push(clusterMap[cluster.name] ? "Yes" : "No")
        })
        output.push(row)
      })
    }
  })
  return output
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  actions: [
    {
      name: "List/Compare Services",
      order: 10,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const namespaces = actionContext.getNamespaces()

        const clusterServices = await k8sFunctions.getServicesGroupedByClusterNamespace(clusters, namespaces)

        const output = generateServiceComparisonOutput(clusters, namespaces, clusterServices)
        actionContext.onOutput && actionContext.onOutput(output, ActionOutputStyle.Compare)
      },
    }
  ]
}

export default plugin
