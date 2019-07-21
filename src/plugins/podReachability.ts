/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, } from '../actions/actionSpec'
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
        const selections = await ChoiceManager.getPodSelections(actionContext, false, true)
        this.setScrollMode && this.setScrollMode(true)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const i in selections) {
          const output: ActionOutput = []
          const sourceIndex = parseInt(i)
          const selection = selections[sourceIndex]
          output.push([">From: " + selection.title + ", Cluster: " + selection.cluster, "",""])

          if(!selection.k8sClient.canPodExec) {
            output.push(["Lacking pod command execution privileges"])
            this.onStreamOutput && this.onStreamOutput(output)
            continue
          }
          try {
            const result = await k8sFunctions.podExec(selection.namespace, selection.podName, selection.containerName,
                                selection.k8sClient, ["ping", "-c", "1", "127.0.0.1"])
            const pingExists = result.includes("transmitted")
            console.log(result)
            if(!pingExists) {
              output.push(["", "Cannot test reachability from " + selection.title + " because ping command not found", ""])
              this.onStreamOutput && this.onStreamOutput(output)
              continue
            }
          } catch(error) {
            output.push(["", "Error from pod " + selection.title + ": " + error.message, ""])
            this.onStreamOutput && this.onStreamOutput(output)
            continue
          }
          for(const j in selections) {
            const target = selections[j]
            if(i === j || !target || !target.podIP) {
              continue
            }
            const ip = target.podIP
            const result = await k8sFunctions.podExec(selection.namespace, selection.podName, selection.containerName, 
              selection.k8sClient, ["ping", "-c", "2", ip])
            const pingSuccess = result.includes("0% packet loss")
            output.push([[target.podName, "IP: "+ip, "Cluster: " + target.cluster],
              result,
              pingSuccess ? "Reachable" : "Unreachable"
            ])
          }
          this.onStreamOutput && this.onStreamOutput(output)
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