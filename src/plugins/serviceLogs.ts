import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionSpec, } from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'
import ActionContext from '../actions/actionContext';
import { ServiceDetails } from '../k8s/k8sObjectTypes';


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Service Recipes",

  selectedServices: undefined,
  selectedPodAndContainers: undefined,
  logStreams: [],

  getSelectionAsText() {
    if(this.selectedPodAndContainers) {
      return this.selectedPodAndContainers.map(s => 
          "["+s.container+"@"+s.pod+"."+s.namespace+"."+s.cluster+"]")
          .join(", ")
    }
    return ""
  },

  storeSelectedServices(actionContext: ActionContext, action: ActionSpec) {
    const selections = ChoiceManager.getSelections(actionContext)
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

  async getServicePodLogs(actionContext: ActionContext, action: ActionSpec, tail: boolean) {
    action.onOutput && action.onOutput([["Pod", "Logs for: " + this.getSelectionAsText()]], ActionOutputStyle.Log)
    const lineCount = (50/this.selectedPodAndContainers.length) < 20 ? 20 : (50/this.selectedPodAndContainers.length)
    for(const pc of this.selectedPodAndContainers) {
      action.showOutputLoading && action.showOutputLoading(true)
      const logStream = await k8sFunctions.getPodLog(pc.namespace, 
                              pc.pod, pc.container, pc.k8sClient, tail, lineCount)
      logStream.onLog(lines => {
        lines = lines.split("\n")
                .filter(line => line.length > 0)
                .map(line => [pc.container+"@"+pc.pod, line])
        action.onStreamOutput && action.onStreamOutput(lines)
      })
      if(tail) {
        this.logStreams.push(logStream)
        action.showOutputLoading && action.showOutputLoading(false)
      } else {
        setTimeout(() => {
          action.showOutputLoading && action.showOutputLoading(false)
          logStream.stop()
        }, 10000)
      }
    }
  },
  async performAction(actionContext: ActionContext, action: ActionSpec, tail: boolean) {
    const selections = ChoiceManager.getSelections(actionContext)
    if(selections.length < 1) {
      action.onOutput && action.onOutput([["No service selected"]], ActionOutputStyle.Text)
      return
    }
    action.setScrollMode && action.setScrollMode(true)
    this.storeSelectedServices(actionContext, action)
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
    await this.getServicePodLogs(actionContext, action, tail)
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
    await ChoiceManager.prepareCachedChoices(actionContext, k8sFunctions.getServices, 
                                          "Services", 1, 3, true, "name")
  },

  actions: [
    {
      name: "Check Service Logs",
      order: 40,
      autoRefreshDelay: 60,
      loadingMessage: "Loading Services...",

      async choose(actionContext) {
        await plugin.performChoose(actionContext, this)
      },
      async act(actionContext) {
        await plugin.performAction(actionContext, this, false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([["Pod", "Logs for: " + plugin.getSelectionAsText()]], ActionOutputStyle.Log)
      }
    },
    {
      name: "Tail Service Logs",
      order: 41,
      loadingMessage: "Loading Services...",

      async choose(actionContext) {
        await plugin.performChoose(actionContext, this)
      },
      async act(actionContext) {
        await plugin.performAction(actionContext, this, true)
      },
      stop(actionContext) {
        if(plugin.logStreams.length > 0) {
          plugin.logStreams.forEach(stream => stream.stop())
          plugin.logStreams = []
        }
      },
      clear() {
        this.onOutput && this.onOutput([["Pod", "Logs for: " + plugin.getSelectionAsText()]], ActionOutputStyle.Log)
      }
    }
  ]
}

export default plugin