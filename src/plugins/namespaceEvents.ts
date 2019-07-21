/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import K8sFunctions from '../k8s/k8sFunctions'
import ChoiceManager from '../actions/choiceManager';
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, ActionContextOrder} from '../actions/actionSpec'
import { Namespace } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Events",
  order: ActionContextOrder.Events,
  actions: [
    {
      name: "Namespace Events",
      order: 1,
      autoRefreshDelay: 15,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, false, 1, 10),
      
      async act(actionContext) {
        this.clear && this.clear(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)
        const selections = await ChoiceManager.getSelections(actionContext)
        const clusters = actionContext.getClusters()
        const namespaces = actionContext.getNamespaces()
        for(const i in clusters) {
          const output: ActionOutput = []
          const cluster = clusters[i]
          output.push([">Cluster: " + cluster.name, ""])

          let clusterNamespaces = selections.filter(s => s.cluster === cluster.name).map(s => s.item) as Namespace[]

          for(const namespace of clusterNamespaces) {
            output.push([">>Namespace: "+namespace.name, ""])
            const events = await K8sFunctions.getNamespaceEvents(namespace.name, cluster.k8sClient)
            events.forEach(event => {
              if(event.reason === "No Events") {
                output.push([event.reason])
              } else {
                output.push([
                  [event.reason, event.lastTimestamp, event.count ? "(" + event.count + ")" : ""],
                  event.type ? {
                    type: event.type,
                    source: event.source,
                    message: event.message,
                   } : {},
                ])
              }
            })
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([[["Event", "LastTimestamp", "(Count)"], "Details",]], ActionOutputStyle.TableWithHealth)
      },
    },
  ]
}

export default plugin
