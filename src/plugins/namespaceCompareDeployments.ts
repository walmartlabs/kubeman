import k8sFunctions, {StringStringStringBooleanMap} from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'
import ActionContext from '../actions/actionContext'
import {Cluster, Namespace} from "../k8s/k8sObjectTypes";


export function generateDeploymentComparisonOutput(clusters: Cluster[], namespaces: Namespace[], deployments: any) {
  const output: ActionOutput = []
  const headers = ["Namespace/Deployment"]
  clusters.forEach(cluster => {
    headers.push("In " + cluster.name)
  })
  output.push(headers)

  const nsDeploymentToClusterMap : StringStringStringBooleanMap = {}
  namespaces.forEach(ns => {
    const namespace = ns.name
    nsDeploymentToClusterMap[namespace] = {}
    Object.keys(deployments).forEach(cluster => {
      const clusterNSDeployments = deployments[cluster][namespace]
      clusterNSDeployments && 
        clusterNSDeployments.forEach(deployment => {
          if(!nsDeploymentToClusterMap[namespace][deployment]) {
            nsDeploymentToClusterMap[namespace][deployment] = {}
          }
          nsDeploymentToClusterMap[namespace][deployment][cluster] = true
        })
    })
  })

  Object.keys(nsDeploymentToClusterMap).forEach(namespace => {
    output.push([">Namespace: " + namespace, "", ""])
    const deploymentToClusterMap = nsDeploymentToClusterMap[namespace]
    const deployments = Object.keys(deploymentToClusterMap)
    if(deployments.length === 0) {
      output.push(["No Deployments", "", ""])
    } else {
      deployments.forEach(deployment => {
        const clusterMap = deploymentToClusterMap[deployment]
        const deploymentRow = [deployment]
        clusters.forEach(cluster => {
          deploymentRow.push(clusterMap[cluster.name] ? "Yes" : "No")
        })
        output.push(deploymentRow)
      })
    }
  })
  return output
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  actions: [
    {
      name: "List/Compare Deployments",
      order: 4,
      async act(actionContext: ActionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()
        const namespaces = actionContext.getNamespaces()

        const deployments = await k8sFunctions.getDeploymentsGroupedByClusterNamespace(clusters, k8sClients, namespaces)

        const output = generateDeploymentComparisonOutput(clusters, namespaces, deployments)
        actionContext.onOutput && actionContext.onOutput(output, ActionOutputStyle.Compare)
      },
    }
  ]
}

export default plugin
