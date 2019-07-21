/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionSpec, } from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'
import {executeCommand} from './podExecCommand'


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Service Recipes",

  actions: [
    {
      name: "Execute Command on Service Pods",
      order: 50,
      loadingMessage: "Loading Services...",

      selectedCluster: undefined,
      selectedService: undefined,
      selectedContainer: undefined,
      servicePods: undefined,
          
      async choose(actionContext) {
        await ChoiceManager.chooseServiceAndContainer(this, actionContext)
      },

      async act(actionContext) {
        this.showOutputLoading && this.showOutputLoading(true)
        const selections = (await ChoiceManager.getDoubleSelections(actionContext))
        const serviceSelection = selections[0][0]
        this.selectedService = serviceSelection.item
        this.selectedContainer = selections[1][0].item
        this.selectedCluster = actionContext.getClusters().filter(cluster => cluster.name === serviceSelection.cluster)[0]
        const k8sClient = this.selectedCluster.k8sClient
        const podsAndContainers = await k8sFunctions.getPodsAndContainersForService(this.selectedService, k8sClient)
        const pods = podsAndContainers.pods ? podsAndContainers.pods as string[] : []
        this.servicePods = pods.map(pod => {
            return {
              container: this.selectedContainer.name,
              pod,
              namespace: serviceSelection.namespace,
              cluster: serviceSelection.cluster,
              k8sClient: k8sClient
            }
          })
        this.clear && this.clear(actionContext)
        this.setScrollMode && this.setScrollMode(true)
        this.showOutputLoading && this.showOutputLoading(false)
      },
      
      async react(actionContext) {
        this.showOutputLoading && this.showOutputLoading(true)
        await executeCommand(this.servicePods, actionContext, this.clear, this.onStreamOutput)
        this.showOutputLoading && this.showOutputLoading(false)
      },

      refresh(actionContext) {
        this.react && this.react(actionContext)
      },

      clear() {
        const serviceTitle = this.selectedService.name+"."+this.selectedService.namespace+" @ "+this.selectedCluster.name
        this.onOutput && this.onOutput([[
          "Send Command To Container [ " + this.selectedContainer.name + " ] on [ " + 
          this.servicePods.length + " ] pods of Service [ " + serviceTitle + " ] on cluster [ " + this.selectedCluster.name + " ]"
        ]], ActionOutputStyle.Mono)
      },
    }
  ]
}

export default plugin