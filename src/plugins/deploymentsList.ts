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
      name: "List Deployments for Namespaces",
      order: 1,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, false, 1, 10),

      async act(actionContext: ActionContext) {
        this.onOutput && this.onOutput([["Deployments List", ""]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        const clusters = actionContext.getClusters()
        const selections = await ChoiceManager.getSelections(actionContext)
        for(const selection of selections) {
          const output: ActionOutput = []
          const cluster = clusters.filter(c => c.name === selection.cluster)[0]
          const namespace = selection.item as Namespace
          const deployments = await K8sFunctions.getNamespaceDeployments(cluster.name, namespace.name, cluster.k8sClient)

          output.push([">Namespace " + namespace.name + ", Cluster: " + cluster.name, ""])
          for(const deployment of deployments) {
            output.push([">>"+deployment.name, ""])
            output.push(["status", deployment.status])
            output.push(["creationTimestamp", deployment.creationTimestamp])
            output.push(["labels", deployment.labels])
            output.push(["annotations", deployment.annotations])
            output.push(["replicas", deployment.replicas])
            output.push(["strategy", deployment.strategy])
          }
          deployments.length === 0 && output.push([">>>No Deployments", ""])
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
    {
      name: "Compare Namespace Deployments",
      order: 2,
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
