/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionContextOrder, ActionOutputStyle} from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'
import K8sPluginHelper from '../k8s/k8sPluginHelper'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Resources",
  order: ActionContextOrder.Resources,
  actions: [
    {
      name: "View ConfigMap Details",
      order: 30,
      loadingMessage: "Loading ConfigMaps...",
      async choose(actionContext) {
        await ChoiceManager.prepareCachedChoices(actionContext, k8sFunctions.getNamespaceConfigMaps, 
                                            "ConfigMaps", 1, 10, true, "name")
      },

      async act(actionContext) {
        const selections = await ChoiceManager.getSelections(actionContext)
        this.onOutput && this.onOutput([["CRD Details"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        for(const selection of selections) {
          this.onStreamOutput && this.onStreamOutput([
            [">"+selection.title+"."+selection.namespace+" @ "+selection.cluster],
            [selection.item.yaml]
          ])
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
