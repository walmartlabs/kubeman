import K8sFunctions, {StringStringStringBooleanMap} from '../k8s/k8sFunctions'
import ChoiceManager from '../actions/choiceManager';
import {ActionGroupSpec, ActionContextType, ActionContextOrder,
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'
import ActionContext from '../actions/actionContext'
import {Cluster, Namespace} from "../k8s/k8sObjectTypes";


export function generateDeploymentComparisonOutput(clusters: Cluster[], namespaces: Namespace[], deployments: any, onStreamOutput) {
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
    const output: ActionOutput = []
    const groupTitle = [">Namespace: " + namespace]
    clusters.forEach(cluster => {
      groupTitle.push("")
    })
    output.push(groupTitle)
    const deploymentToClusterMap = nsDeploymentToClusterMap[namespace]
    const deployments = Object.keys(deploymentToClusterMap)
    if(deployments.length === 0) {
      output.push(["No Deployments", ...clusters.map(() => "")])
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
    onStreamOutput(output)
  })
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Deployment Recipes",
  order: ActionContextOrder.Deployment,
  actions: [
    {
      name: "List/Compare Deployments",
      order: 1,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, true, 1, 10),

      async act(actionContext: ActionContext) {
        const clusters = actionContext.getClusters()
        const headers = ["Namespace/Deployment"]
        clusters.forEach(cluster => {
          headers.push("Cluster: " + cluster.name)
        })
        this.onOutput && this.onOutput([headers], ActionOutputStyle.Compare)
      
        this.showOutputLoading && this.showOutputLoading(true)
        const selections = await ChoiceManager.getSelections(actionContext)
        const namespaces = selections.map(s => s.item) as Namespace[]

        const deployments = await K8sFunctions.getDeploymentsGroupedByClusterNamespace(clusters, namespaces)

        generateDeploymentComparisonOutput(clusters, namespaces, deployments, this.onStreamOutput)
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
