/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import K8sFunctions from '../k8s/k8sFunctions'
import ChoiceManager from '../actions/choiceManager'
import {ActionGroupSpec, ActionContextOrder, ActionContextType, ActionOutput, ActionOutputStyle, SelectionType, } from '../actions/actionSpec'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Events",
  order: ActionContextOrder.Events,
  actions: [
    {
      name: "View Service Events",
      order: 4,
      selectionType: SelectionType.Service,
      autoRefreshDelay: 15,
      loadingMessage: "Loading Services...",
      
      choose: ChoiceManager.chooseService.bind(ChoiceManager, 1, 10),

      async act(actionContext) {
        const selections = await ChoiceManager.getServiceSelections(actionContext)
        this.directAct && this.directAct(selections)
      },

      async directAct(selections) {
        this.clear && this.clear(this.actionContext)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const i in selections) {
          const selection = selections[i]
          const namespace = selection.namespace
          const service = selection.item
          const cluster = this.actionContext.getClusters().filter(c => c.name === selection.cluster)[0]
          const podsAndContainers = await K8sFunctions.getPodsAndContainersForService(service, cluster.k8sClient, false)

          const output: ActionOutput = []
          output.push([">Service: " + service.name+"."+namespace+" @ "+cluster.name, ""])
          if(podsAndContainers.pods) {
            for(const pod of podsAndContainers.pods) {
              output.push([">>Pod: " + pod, ""])
              const events = await K8sFunctions.getPodEvents(namespace, pod, cluster.k8sClient)
              events.forEach(event => {
                if(event.reason === "No Events") {
                  output.push([event.reason])
                }
                else {
                  output.push([
                    [event.reason, event.lastTimestamp, "(" + event.count + ")"],
                    event.type ? {
                      type: event.type,
                      source: event.source,
                      message: event.message,
                    } : {},
                  ])
                }
              })
            }
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([[["Event", "LastTimestamp", "(Count)"], "Details"]], ActionOutputStyle.TableWithHealth)
      },
      filterSelections(selections) {
        return selections && selections.length > 0 ? selections.slice(0, 10) : []
      }
    }
  ]
}

export default plugin
