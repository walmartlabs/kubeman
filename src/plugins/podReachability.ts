import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, } from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'
import { PodContainerDetails } from '../k8s/k8sObjectTypes';


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",

  actions: [
    {
      name: "Test Containers Reachability",
      order: 20,
      autoRefreshDelay: 60,
      loadingMessage: "Loading Containers@Pods...",

      choose: ChoiceManager.choosePods.bind(ChoiceManager, 2, 10, true, true),
      
      async act(actionContext) {
        this.clear && this.clear(actionContext)
        const selections = await ChoiceManager.getPodSelections(actionContext, true)
        this.setScrollMode && this.setScrollMode(true)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const i in selections) {
          const sourceIndex = parseInt(i)
          const selection = selections[sourceIndex]
          this.onStreamOutput && this.onStreamOutput([[
            ">From: " + selection.title + ", Cluster: " + selection.cluster, "",""]])
          try {
            const result = await k8sFunctions.podExec(selection.namespace, selection.podName, selection.containerName, 
                                selection.k8sClient, ["ping", "-c", "1", "127.0.0.1"])
            const pingExists = result.includes("transmitted")
            if(!pingExists) {
              this.onStreamOutput && this.onStreamOutput([
                ["", "Cannot test reachability from " + selection.title + " because ping command not found", ""]
              ])
              continue
            }
          } catch(error) {
            this.onStreamOutput && this.onStreamOutput([
              ["", "Error from pod " + selection.title + ": " + error.message, ""]
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
            const result = await k8sFunctions.podExec(selection.namespace, selection.podName, selection.containerName, 
              selection.k8sClient, ["ping", "-c", "2", ip])
            const pingSuccess = result.includes("0% packet loss")
            this.onStreamOutput && this.onStreamOutput([[
              [target.podName, "IP: "+ip, "Cluster: " + target.cluster],
              result,
              pingSuccess ? "Reachable" : "Unreachable"
            ]])
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([["Pod Reachability Test", "", ""]], ActionOutputStyle.LogWithHealth)
      }
    }
  ]
}

export default plugin