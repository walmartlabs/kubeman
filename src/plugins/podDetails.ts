import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'
import { PodDetails, Namespace } from '../k8s/k8sObjectTypes';
import K8sFunctions from '../k8s/k8sFunctions'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",
  actions: [
    {
      name: "View Pod Addresses",
      order: 2,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, false, 1, 10),
      
      async act(actionContext) {
        this.onOutput && this.onOutput([["Pod Name", "Info"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        const selections = await ChoiceManager.getSelections(actionContext)
        for(const cluster of clusters) {
          this.onStreamOutput && this.onStreamOutput([[">Cluster: "+cluster.name, ""]])
      
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
              }])
            })
            this.onStreamOutput && this.onStreamOutput(output)
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
    {
      name: "View Pod(s) Details",
      order: 3,
      loadingMessage: "Loading Pods...",

      choose: ChoiceManager.choosePods.bind(ChoiceManager, 1, 10, false, true),

      async act(actionContext) {
        const selections = await ChoiceManager.getPodSelections(actionContext, false)
        this.directAct && this.directAct(selections)
      },

      async directAct(selections) {
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No pod selected"]], ActionOutputStyle.Text)
          return
        }
        this.onOutput && this.onOutput([["Keys", "Data"]], ActionOutputStyle.Table)

        selections.forEach(selection => {
          const pod = selection.podName
          const namespace = selection.namespace
          const cluster = selection.cluster
          const podDetails = selection.podContainerDetails as PodDetails
          const output: ActionOutput = []
          output.push([">" + pod + ",Namespace: " + namespace + ", Cluster: " + cluster, ""])
          output.push(["cluster", cluster])
          if(podDetails) {
            Object.keys(podDetails).forEach((key, index) => 
                          podDetails[key] && output.push([key, podDetails[key]]))
          }
          this.onStreamOutput && this.onStreamOutput(output)
        })
      },
    }
  ]
}

export default plugin
