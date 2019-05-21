import {ActionGroupSpec, ActionContextOrder, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import K8sFunctions from '../k8s/k8sFunctions'
import K8sPluginHelper from '../k8s/k8sPluginHelper'
import { PodDetails } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Service Recipes",
  order: ActionContextOrder.Service,
  actions: [
    {
      name: "View Service Details",
      order: 20,
      loadingMessage: "Loading Services...",
      
      choose: ChoiceManager.chooseService.bind(ChoiceManager, 1, 10),

      async act(actionContext) {
        const selections: ItemSelection[] = await ChoiceManager.getSelections(actionContext)
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No service selected"]], ActionOutputStyle.Text)
          return
        }
        this.onOutput && this.onOutput([["Service Details"]], ActionOutputStyle.Table)

        for(const selection of selections) {
          const service = selection.item
          const cluster = actionContext.getClusters().filter(c => c.name === selections[0].cluster)[0]
          const output: ActionOutput = []
          output.push([">" + service.name+"."+service.namespace + " @ " + cluster.name])
          output.push([">>Service"], [service.yaml])

          output.push([">>Service Endpoints"])
          const endpointSubsets = await K8sFunctions.getServiceEndpoints(service.name, service.namespace, cluster.k8sClient)
          const subsetCount = endpointSubsets.length
          const endpointPods = {}
          endpointSubsets.forEach((subset, i) => {
            const subsetPods: any[] = []
            subset.addresses.forEach(a => {
              subsetPods.push({pod: a.targetRef.name, ip: a.ip})
              endpointPods[a.targetRef.name] = a.ip
            })
            subsetCount > 1 && output.push([">>>Endpoints Subset #"+(i+1)])
            output.push([subsetPods])
          })

          output.push([">>Service Pods Details"])
          const podsAndContainers = await K8sFunctions.getPodsAndContainersForService(service, cluster.k8sClient, true)
          if(podsAndContainers && podsAndContainers.pods && podsAndContainers.pods.length > 0) {
            (podsAndContainers.pods as PodDetails[]).forEach(pod => {
              const podIPInEndpoints = endpointPods[pod.name] 
              output.push([">>>"+pod.name +
                (podIPInEndpoints ? ", Endpoint IP: ["+podIPInEndpoints+"]" : " (pod not found in service endpoints)")], 
              [pod.yaml])
            })
          } else {
            output.push(["No pods found for the service"])
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
      order: 30,
      loadingMessage: "Loading Services...",

      choose: ChoiceManager.chooseService.bind(ChoiceManager, 2, 2),

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(actionContext, this.onOutput, "Services")
      },
    }
  ]
}

export default plugin
