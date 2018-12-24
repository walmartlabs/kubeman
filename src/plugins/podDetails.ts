import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput} from '../../src/actions/actionSpec'
import K8sPluginHelper from '../../src/util/k8sPluginHelper'
import { PodDetails } from '../../src/k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Pod,
  actions: [
    {
      name: "List/View Pod(s) Details",
      order: 3,
      
      choose: K8sPluginHelper.choosePod.bind(null, 1, 10, false),

      async act(actionContext) {
        const selections = await K8sPluginHelper.getPodSelections(actionContext, true, false)
        if(selections.length < 1) {
          actionContext.onOutput && actionContext.onOutput([["No pod selected"]], ActionOutputStyle.Text)
          return
        }
        actionContext.onOutput && actionContext.onOutput([["Keys", "Data"]], ActionOutputStyle.Table)

        selections.forEach(selection => {
          const pod = selection.pod
          const namespace = selection.namespace
          const cluster = selection.cluster
          const podDetails = selection.podContainerDetails as PodDetails
          const output: ActionOutput = []
          output.push([">" + pod, ""])
          output.push(["Cluster", cluster])
          output.push(["Namespace", namespace])
          if(podDetails) {
            Object.keys(podDetails).forEach((key, index) => output.push([key, podDetails[key] ||'']))
          }
          actionContext.onStreamOutput && actionContext.onStreamOutput(output)
        })
      },
    }
  ]
}

export default plugin
