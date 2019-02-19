import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'
import { PodDetails } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",
  actions: [
    {
      name: "View Pod(s) Details",
      order: 4,
      loadingMessage: "Loading Pods...",

      choose: ChoiceManager.choosePod.bind(ChoiceManager, 1, 10, false, true),

      async act(actionContext) {
        const selections = await ChoiceManager.getPodSelections(actionContext, true, false)
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No pod selected"]], ActionOutputStyle.Text)
          return
        }
        this.onOutput && this.onOutput([["Keys", "Data"]], ActionOutputStyle.Table)

        selections.forEach(selection => {
          const pod = selection.pod
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
