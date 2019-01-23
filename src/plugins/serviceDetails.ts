import {ActionGroupSpec, ActionContextOrder, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import K8sPluginHelper, {ItemSelection} from '../k8s/k8sPluginHelper'
import K8sFunctions from '../k8s/k8sFunctions'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Service Recipes",
  order: ActionContextOrder[ActionContextType.Namespace]+1,
  actions: [
    {
      name: "View Service Details",
      order: 1,
      
      async choose(actionContext) {
        await K8sPluginHelper.prepareChoices(actionContext, K8sFunctions.getServices, "Services", 1, 10, "name")
      },

      async act(actionContext) {
        const selections: ItemSelection[] = await K8sPluginHelper.getSelections(actionContext, "name")
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No service selected"]], ActionOutputStyle.Text)
          return
        }
        this.onOutput && this.onOutput([["Keys", "Data"]], ActionOutputStyle.Table)

        for(const selection of selections) {
          const cluster = actionContext.getClusters().filter(c => c.name === selections[0].cluster)[0]
          const output: ActionOutput = []
          output.push([">" + selection.title, ""])
          output.push(["cluster", selection.cluster])
          const service = selection.item
          if(service) {
            Object.keys(service).forEach((key, index) => output.push([key, service[key] ||'']))
          }
          const podsAndContainers = await K8sFunctions.getPodsAndContainersForService(
                                          selection.namespace, service, cluster.k8sClient, true)
          if(podsAndContainers && podsAndContainers.pods) {
            const pods = (podsAndContainers.pods as any[]).map(pod => {
              return {
                name: pod.name,
                labels: pod.labels,
                node: pod.nodeName,
                podIP: pod.podIP,
                hostIP: pod.hostIP,
                status: pod.phase,
                startTime: pod.startTime,
                conditions: pod.conditions,
                containerStatuses: pod.containerStatuses
              }
            })
            output.push(["Backing Pods", pods])
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
      },
    },
    {
      name: "Compare Two Services",
      order: 2,
      async choose(actionContext) {
        await K8sPluginHelper.prepareChoices(actionContext, K8sFunctions.getServices, "Services", 2, 2, "name")
      },

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, this.onOutput, "Services")
      },
    }
  ]
}

export default plugin
