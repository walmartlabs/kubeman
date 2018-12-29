import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, } from '../actions/actionSpec'
import K8sPluginHelper from '../k8s/k8sPluginHelper'
import { PodContainerDetails } from '../k8s/k8sObjectTypes';


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Actions",

  actions: [
    {
      name: "Test Pods Reachability",
      order: 7,
      
      choose: K8sPluginHelper.choosePod.bind(K8sPluginHelper, 2, 5, true, true),
      
      async act(actionContext) {
        const selections = await K8sPluginHelper.getPodSelections(actionContext, true)
        if(selections.length < 2) {
          actionContext.onOutput && actionContext.onOutput([["Not enough pods selected"]], ActionOutputStyle.Text)
          return
        }
        actionContext.onOutput && actionContext.onOutput([["Pod Reachability Test", "", ""]], ActionOutputStyle.Log)

        for(const i in selections) {
          const sourceIndex = parseInt(i)
          const selection = selections[sourceIndex]
          actionContext.onStreamOutput && actionContext.onStreamOutput([[
            ">From: " + selection.title + ", Cluster: " + selection.cluster, "",""]])
          const result = await k8sFunctions.podExec(selection.namespace, selection.pod, selection.container, 
                              selection.k8sClient, ["ping", "-c 1", "127.0.0.1"])
          const pingExists = result.includes("transmitted")
          if(!pingExists) {
            actionContext.onStreamOutput && actionContext.onStreamOutput([
              ["", "Cannot test reachability from " + selection.title + " because ping command not found", ""]
            ])
            continue
          }
          for(const j in selections) {
            const target = selections[j]
            const podContainerDetails = target.podContainerDetails as PodContainerDetails
            if(i === j || !podContainerDetails || !podContainerDetails.podStatus 
              || !podContainerDetails.podStatus.podIP) {
              continue
            }
            const ip = podContainerDetails.podStatus.podIP
            const result = await k8sFunctions.podExec(selection.namespace, selection.pod, selection.container, 
              selection.k8sClient, ["ping", "-c 2", ip])
            const pingSuccess = result.includes("2 received")
            actionContext.onStreamOutput && actionContext.onStreamOutput([[
              [target.pod, "IP: "+ip, "Cluster: " + target.cluster],
              result,
              pingSuccess ? "Reachable" : "Unreachable"
            ]])
          }
        }
      },
      stop(actionContext) {
      }
    }
  ]
}

export default plugin