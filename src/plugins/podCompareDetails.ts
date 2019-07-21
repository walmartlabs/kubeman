/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType} from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'
import K8sPluginHelper from '../k8s/k8sPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",
  actions: [
    {
      name: "Compare Two Pods",
      order: 15,
      loadingMessage: "Loading Pods...",

      choose: ChoiceManager.choosePods.bind(ChoiceManager, 2, 2, false, true),

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(this, actionContext, 
          ChoiceManager.getPodSelections.bind(ChoiceManager, actionContext, true, false), this.onOutput, this.onStreamOutput, "Pods")
      },
    }
  ]
}

export default plugin
