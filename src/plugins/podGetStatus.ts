import JsonUtil from '../../src/util/jsonUtil'
import k8sFunctions from '../../src/k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../../src/actions/actionSpec'
import { PodDetails } from '../../src/k8s/k8sObjectTypes';

type ClusterNamespacePodsMap = {[cluster: string]: {[namespace: string]: PodDetails[]}}

function generatePodStatusOutput(podsMap: ClusterNamespacePodsMap) {
  const output: ActionOutput = []
  output.push(["Pod", "Created", "Container Status"])

  Object.keys(podsMap).forEach(cluster => {
    output.push(["Cluster: "+cluster, "---", "---"])

    const namespaces = Object.keys(podsMap[cluster])
    namespaces.forEach(namespace => {
      output.push([">Namespace: "+namespace, "---", "---"])

      const pods = podsMap[cluster][namespace]
      if(pods.length === 0) {
        output.push(["No pods selected", "", ""])
      } else {
        pods.forEach(pod => {
          output.push([pod.name, pod.creationTimestamp, pod.containerStatuses])
        })
      }
    })
  })
  return output
}


const plugin : ActionGroupSpec = {
  context: ActionContextType.Pod,
  actions: [
    {
      name: "Get Pod Status",
      order: 2,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const namespaces = actionContext.getNamespaces()
        const pods = actionContext.getPods()
        const k8sClients = actionContext.getK8sClients()

        const podsMap : ClusterNamespacePodsMap = {}
        for(const c in clusters) {
          const cluster = clusters[c]
          podsMap[cluster.name] = {}
          const clusterNamespaces = namespaces.filter(ns => ns.cluster.name === cluster.name)
          for(const n in clusterNamespaces) {
            const namespace = clusterNamespaces[n]
            podsMap[cluster.name][namespace.name] = []

            const podNames = pods.filter(pod => pod.namespace.cluster.name === cluster.name)
                          .filter(pod => pod.namespace.name === namespace.name)
                          .map(pod => pod.name)
            if(podNames.length > 0) {
              const nsPods = await k8sFunctions.getNamespacePods(namespace.name, podNames, k8sClients[c])
              nsPods.forEach(pod => pod && podsMap[cluster.name][namespace.name].push(pod))
            }
            const output = generatePodStatusOutput(podsMap)
            actionContext.onOutput && actionContext.onOutput(output, ActionOutputStyle.Table)
          }
        }
      }
    }
  ]
}

export default plugin
