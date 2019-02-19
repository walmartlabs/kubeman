import {ActionGroupSpec, ActionContextOrder, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import K8sFunctions from '../k8s/k8sFunctions'
import { Namespace } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",
  order: ActionContextOrder.Pod,
  
  actions: [
    {
      name: "List Pods",
      order: 1,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, false, 1, 10),
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Pod Name", "Summary Info"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        const selections = await ChoiceManager.getSelections(actionContext)
        for(const cluster of clusters) {
          this.onStreamOutput && this.onStreamOutput([[">Cluster: "+cluster.name, ""]])
      
          if(cluster.hasIstio) {
            let clusterNamespaces = selections.filter(s => s.cluster === cluster.name).map(s => s.item) as Namespace[]
            for(const namespace of clusterNamespaces) {
              const output: ActionOutput = []
              output.push([">>Namespace: "+namespace.name, ""])
              const pods = await K8sFunctions.getAllPodsForNamespace(namespace.name, cluster.k8sClient)
              pods.length === 0 && output.push(["", "No pods found"])
              pods.forEach(pod => {
                output.push([pod.name, {
                  podIP: pod.podIP,
                  hostIP: pod.hostIP,
                  nodeName: pod.nodeName,
                  labels: pod.labels,
                  annotations: pod.annotations,
                  volumes: pod.volumes.map(v => v.name),
                  containers: pod.containers.map(c => {
                    return {
                      name: c.name,
                      status: pod.containerStatuses.filter(cs => cs.name === c.name)
                              .map(cs => cs.state)
                    }
                  }),
                  conditions: pod.conditions,
                }])
              })
              this.onStreamOutput && this.onStreamOutput(output)
            }
          } else {
            this.onStreamOutput && this.onStreamOutput([["", "Istio not installed"]])
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
