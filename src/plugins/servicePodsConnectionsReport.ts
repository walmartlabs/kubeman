/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextOrder, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import K8sFunctions from '../k8s/k8sFunctions'
import K8sPluginHelper from '../k8s/k8sPluginHelper'
import { PodDetails, ContainerInfo } from '../k8s/k8sObjectTypes'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Service Recipes",
  order: ActionContextOrder.Service,
  actions: [
    {
      name: "Service Pods Connections Report",
      order: 30,
      loadingMessage: "Loading Services...",
      
      async choose(actionContext) {
        await ChoiceManager.chooseServiceAndContainer(this, actionContext)
      },

      async act(actionContext) {
        this.showOutputLoading && this.showOutputLoading(true)
        const selections = await ChoiceManager.getDoubleSelections(actionContext)
        const serviceSelection = selections[0][0]
        const service = serviceSelection.item
        const container: ContainerInfo = selections[1][0].item
        const cluster = actionContext.getClusters().filter(c => c.name === serviceSelection.cluster)[0]
        const k8sClient = cluster.k8sClient

        this.onOutput && this.onOutput([["Connections Report for Service " + service.name+"."+service.namespace + " @ " + cluster.name]], ActionOutputStyle.Mono)

        const output: ActionOutput = []
        const podsAndContainers = await K8sFunctions.getPodsAndContainersForService(service, k8sClient, true)
        const pods: PodDetails[] = podsAndContainers && podsAndContainers.pods ? podsAndContainers.pods as PodDetails[] : []
        if(pods.length > 0) {
          for(const pod of pods) {
            output.push([">Pod: " + pod.name])
            if(!k8sClient.canPodExec) {
              output.push(["Lacking pod command execution privileges"])
            } else {
              const result = await K8sFunctions.getPodTCPConnectionsInfo(service.namespace, pod.name, 
                                    container.name, k8sClient)
              output.push(result ? [result] : ["No Results"])
            }
          }
        } else {
          output.push(["No pods found for the service"])
        }
        this.onStreamOutput && this.onStreamOutput(output)
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    }
  ]
}

export default plugin
