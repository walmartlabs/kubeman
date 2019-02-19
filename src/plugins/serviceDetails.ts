import {ActionGroupSpec, ActionContextOrder, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import K8sFunctions from '../k8s/k8sFunctions'
import K8sPluginHelper from '../k8s/k8sPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Service Recipes",
  order: ActionContextOrder.Service,
  actions: [
    {
      name: "View Service Details",
      order: 10,
      loadingMessage: "Loading Services...",
      
      async choose(actionContext) {
        await ChoiceManager.prepareCachedChoices(actionContext, K8sFunctions.getServices, 
                                                "Services", 1, 10, true, "name")
      },

      async act(actionContext) {
        const selections: ItemSelection[] = await ChoiceManager.getSelections(actionContext)
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
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Compare Two Services",
      order: 11,
      loadingMessage: "Loading Services...",
      async choose(actionContext) {
        await ChoiceManager.prepareCachedChoices(actionContext, K8sFunctions.getServices, 
                                              "Services", 2, 2, true, "name")
      },

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, this.onOutput, "Services")
      },
    }
  ]
}

export default plugin
