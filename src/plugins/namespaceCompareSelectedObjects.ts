/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionContextOrder} from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'
import K8sPluginHelper from '../k8s/k8sPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Resources",
  order: ActionContextOrder.Resources,
  actions: [
    {
      name: "Compare Two Secrets",
      order: 21,
      loadingMessage: "Loading Secrets...",
      async choose(actionContext) {
        await ChoiceManager.prepareCachedChoices(actionContext, k8sFunctions.getNamespaceSecrets, 
                                                  "Secrets", 2, 2, true, "name")
      },

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(this, actionContext, 
          ChoiceManager.getSelections.bind(ChoiceManager), this.onOutput, this.onStreamOutput, "Secrets", "name")
      },
    },
    {
      name: "Compare Two ConfigMaps",
      order: 22,
      loadingMessage: "Loading Config Maps...",
      async choose(actionContext) {
        await ChoiceManager.prepareCachedChoices(actionContext, k8sFunctions.getNamespaceConfigMaps, 
                                            "Config Maps", 2, 2, true, "name")
      },

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(this, actionContext, 
          ChoiceManager.getSelections.bind(ChoiceManager), this.onOutput, this.onStreamOutput, "Config Maps")
      },
    }
  ]
}

export default plugin
