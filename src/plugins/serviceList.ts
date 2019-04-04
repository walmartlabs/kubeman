import {ActionGroupSpec, ActionContextOrder, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import K8sFunctions from '../k8s/k8sFunctions'
import { Namespace } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Service Recipes",
  order: ActionContextOrder.Service,
  actions: [
    {
      name: "List Namespace Services",
      order: 1,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, false, 1, 10),

      async act(actionContext) {
        this.onOutput && this.onOutput([["Service Name", "Summary Info"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        const selections = await ChoiceManager.getSelections(actionContext)
        for(const cluster of clusters) {
          this.onStreamOutput && this.onStreamOutput([[">Cluster: "+cluster.name, ""]])
          let clusterNamespaces = selections.filter(s => s.cluster === cluster.name).map(s => s.item) as Namespace[]
          for(const namespace of clusterNamespaces) {
            const output: ActionOutput = []
            output.push([">>Namespace: "+namespace.name, ""])
            const services = await K8sFunctions.getServices(cluster.name, namespace.name, cluster.k8sClient)
            services.length === 0 && output.push(["", "No services found"])
            services.forEach(service => {
              output.push([service.name, {
                type: service.type,
                clusterIP: service.clusterIP,
                labels: service.labels,
                annotations: service.annotations,
                ports: service.ports,
                selector: service.selector
              }])
            })
            this.onStreamOutput && this.onStreamOutput(output)
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
