import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import k8sFunctions from '../k8s/k8sFunctions'
import K8sPluginHelper from '../k8s/k8sPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Deployment Recipes",
  order: ActionContextOrder.Deployment,
  actions: [
    {
      name: "View Deployment Details",
      order: 10,
      loadingMessage: "Loading Deployments...",
      
      async choose(actionContext) {
        await ChoiceManager.prepareCachedChoices(actionContext, k8sFunctions.getNamespaceDeployments, 
                                          "Deployments", 1, 10, true, "name")
      },

      async act(actionContext) {
        const selections: ItemSelection[] = await ChoiceManager.getSelections(actionContext)
        this.onOutput && this.onOutput([["Keys", "Data"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        const clusters = actionContext.getClusters()
        for(const selection of selections) {
          const output: ActionOutput = []
          output.push([">" + selection.title+"."+selection.namespace+" @ "+selection.cluster, ""])
          const deployment = selection.item
          const cluster = clusters.filter(c => c.name === selection.cluster)[0]
          if(deployment) {
            const scale = (await cluster.k8sClient.apps.namespaces(selection.namespace)
                                .deployments(deployment.name).scale.get()).body
            output.push(["name", deployment.name])
            output.push(["namespace", deployment.namespace])
            output.push(["cluster", selection.cluster])
            output.push(["scale", {desired: scale.spec.replicas, current: scale.status.replicas}])
            output.push(["status", deployment.status])
            output.push(["creationTimestamp", deployment.creationTimestamp])
            output.push(["labels", deployment.labels])
            output.push(["annotations", deployment.annotations])
            output.push(["replicas", deployment.replicas])
            output.push(["strategy", deployment.strategy])
            output.push(["yaml", deployment.yaml])
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
    {
      name: "Compare Two Deployments",
      order: 11,
      loadingMessage: "Loading Deployments...",
      async choose(actionContext) {
        await ChoiceManager.prepareCachedChoices(actionContext, k8sFunctions.getNamespaceDeployments, 
                                            "Deployments", 2, 2, true, "name")
      },

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, this.onOutput, "Deployments")
      },
    }
  ]
}

export default plugin
