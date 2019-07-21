/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionSpec, } from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'
import ActionContext from '../actions/actionContext'
import { ServiceDetails } from '../k8s/k8sObjectTypes'
import StreamLogger from '../logger/streamLogger'
import OutputManager from '../output/outputManager'


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Service Recipes",

  selectedServices: undefined,
  selectedPodAndContainers: undefined,

  getSelectionAsText() {
    if(this.selectedServices) {
      return this.selectedServices.map(s => 
          "Services ["+s.service.name+"."+s.namespace+" @ "+s.cluster+"]")
          .join(", ")
    }
    return "[No Service Selected]"
  },

  async storeSelectedServices(actionContext: ActionContext, action: ActionSpec) {
    const selections = await ChoiceManager.getServiceSelections(actionContext)
    if(selections.length < 1) {
      action.onOutput && action.onOutput([["No service selected"]], ActionOutputStyle.Text)
      return
    }
    this.selectedServices = selections.map(s => {
      return {
        service: s.item as ServiceDetails,
        cluster: s.cluster,
        namespace: s.namespace,
        k8sClient: actionContext.getClusters().filter(cluster => cluster.name === s.cluster)
                                              .map(c => c.k8sClient)[0],
      }
    })
  },

  async getServicePodLogs(actionContext: ActionContext, action: ActionSpec, tail: boolean, ...filters) {
    const podRowLimit = Math.ceil((action.outputRowLimit || 200)/this.selectedPodAndContainers.length)
    StreamLogger.init(action.outputRowLimit, action.onStreamOutput, ...filters)
    filters.length > 0 && OutputManager.filter(filters.join(" "))

    for(const pc of this.selectedPodAndContainers) {
      action.showOutputLoading && action.showOutputLoading(true)
      const title = pc.container+"@"+pc.pod
      const logStream = await k8sFunctions.getPodLog(pc.namespace, 
                              pc.pod, pc.container, pc.k8sClient, tail, podRowLimit)
      StreamLogger.captureLogStream(title, logStream)
      if(!tail) {
        setTimeout(() => {
          action.showOutputLoading && action.showOutputLoading(false)
          StreamLogger.stop()
        }, 5000)
      } else {
        action.showOutputLoading && action.showOutputLoading(false)
      }
    }
  },
  async performAction(actionContext: ActionContext, action: ActionSpec, tail: boolean, ...filters) {
    action.setScrollMode && action.setScrollMode(false)
    this.selectedPodAndContainers = []
    for(const s of this.selectedServices) {
      const podsAndContainers = await k8sFunctions.getPodsAndContainersForService(s.service, s.k8sClient)
      const pods = podsAndContainers.pods ? podsAndContainers.pods as string[] : []
      const containers = podsAndContainers.containers ? podsAndContainers.containers as string[] : []
      pods.forEach(pod => {
        containers.forEach(container => {
          this.selectedPodAndContainers.push({
            pod, 
            container, 
            namespace: s.namespace, 
            cluster: s.cluster, 
            k8sClient: s.k8sClient
          })
        })
      })
    }
    await this.getServicePodLogs(actionContext, action, tail, ...filters)
  },

  async performChoose(actionContext: ActionContext, action: ActionSpec) {
    this.selectedServices = undefined
    this.selectedPods = undefined


    this.selectedService = undefined
    this.selectedCluster = undefined
    this.selectedNamespace = undefined
    this.selectedService = undefined
    this.selectedContainer = undefined
    this.k8sClient = undefined
    this.podsAndContainers = undefined
    action.stop && action.stop(actionContext)
    action.stopped = false
    await ChoiceManager.chooseService(1, 1, actionContext)
  },

  actions: [
    {
      name: "Check Service Logs",
      order: 40,
      autoRefreshDelay: 60,
      loadingMessage: "Loading Services...",
      outputRowLimit: 1000,

      async choose(actionContext) {
        await plugin.performChoose(actionContext, this)
      },
      async act(actionContext) {
        await plugin.storeSelectedServices(actionContext, this)
        this.clear && this.clear(actionContext)
        await plugin.performAction(actionContext, this, false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([["Logs for " + plugin.getSelectionAsText()]], ActionOutputStyle.Log)
      }
    },
    {
      name: "Tail Service Logs",
      order: 41,
      loadingMessage: "Loading Services...",
      outputRowLimit: 300,

      async choose(actionContext) {
        await plugin.performChoose(actionContext, this)
      },
      async act(actionContext) {
        await plugin.storeSelectedServices(actionContext, this)
        this.clear && this.clear(actionContext)
        await plugin.performAction(actionContext, this, true)
      },
      stop(actionContext) {
        StreamLogger.stop()
      },
      clear() {
        this.onOutput && this.onOutput([["Tail Logs for " + plugin.getSelectionAsText()]], ActionOutputStyle.Log)
      }
    },
    {
      name: "Tail Filtered Service Logs",
      order: 42,
      loadingMessage: "Loading Services...",
      outputRowLimit: 300,
      filter: undefined,

      async choose(actionContext) {
        await plugin.performChoose(actionContext, this)
      },

      async act(actionContext) {
        this.filter = undefined
        await plugin.storeSelectedServices(actionContext, this)
        this.clear && this.clear(actionContext)
      },
      
      async react(actionContext) {
        StreamLogger.stop()
        this.filter = actionContext.inputText
        this.clear && this.clear(actionContext)
        await plugin.performAction(actionContext, this, true, this.filter)
      },

      stop(actionContext) {
        StreamLogger.stop()
      },

      clear() {
        let title = "Tail Filtered Logs for " + plugin.getSelectionAsText()
        if(this.filter) {
          title += ", Applied Filter: [ " + this.filter + " ]"
        }
        this.onOutput && this.onOutput([[title, ""]], ActionOutputStyle.Log)
      }
    }
  ]
}

export default plugin