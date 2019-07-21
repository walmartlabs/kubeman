/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import k8sFunctions from '../k8s/k8sFunctions'
import K8sPluginHelper from '../k8s/k8sPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Deployment Recipes",
  order: ActionContextOrder.Deployment,
  actions: [
    {
      name: "View Deployment Details",
      order: 10,
      loadingMessage: "Loading Deployments...",
      
      async choose(actionContext) {
        await ChoiceManager.prepareCachedChoices(actionContext, k8sFunctions.getNamespaceDeployments, 
                                          "Deployments", 1, 10, true, "name")
      },

      async act(actionContext) {
        const selections: ItemSelection[] = await ChoiceManager.getSelections(actionContext)
        this.onOutput && this.onOutput([["Deployment Details"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        const clusters = actionContext.getClusters()
        for(const selection of selections) {
          const output: ActionOutput = []
          const deployment = selection.item
          output.push([">" + selection.title+"."+selection.namespace+" @ "+selection.cluster + 
                        ", CreationTimestamp: " + deployment.creationTimestamp])
          const cluster = clusters.filter(c => c.name === selection.cluster)[0]
          const scale = (await cluster.k8sClient.apps.namespaces(selection.namespace)
                              .deployments(deployment.name).scale.get()).body
          output.push([">>>Scale: Desired = " + scale.spec.replicas + ", Current = " +scale.status.replicas])
          output.push([deployment.yaml])
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
    {
      name: "Compare Two Deployments",
      order: 11,
      loadingMessage: "Loading Deployments...",
      async choose(actionContext) {
        await ChoiceManager.prepareCachedChoices(actionContext, k8sFunctions.getNamespaceDeployments, 
                                            "Deployments", 2, 2, true, "name")
      },

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(this, actionContext, 
          ChoiceManager.getSelections.bind(ChoiceManager), this.onOutput, this.onStreamOutput, "Deployments")
      },
    }
  ]
}

export default plugin
