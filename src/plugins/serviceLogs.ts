import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionSpec, } from '../actions/actionSpec'
import K8sPluginHelper from '../k8s/k8sPluginHelper'
import ActionContext from '../actions/actionContext';
import { ServiceDetails } from '../k8s/k8sObjectTypes';


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,

  selectedCluster: undefined,
  selectedNamespace: undefined,
  selectedService: undefined,
  selectedContainer: undefined,
  k8sClient: undefined,
  podsAndContainers: undefined,
  logStreams: [],

  storeSelectedService(actionContext: ActionContext, action: ActionSpec) {
    const selections = K8sPluginHelper.getSelections(actionContext, "name")
    if(selections.length < 1) {
      action.onOutput && action.onOutput([["No service selected"]], ActionOutputStyle.Text)
      return
    }
    const selection = selections[0]
    this.selectedCluster = selection.cluster
    this.selectedNamespace = selection.namespace
    this.selectedService = selection.item as ServiceDetails
    this.k8sClient = actionContext.getClusters().filter(cluster => cluster.name === selection.cluster)
                                            .map(cluster => cluster.k8sClient)[0]
  },

  storeSelectedContainer(actionContext: ActionContext, action: ActionSpec) {
    const selections = K8sPluginHelper.getSelections(actionContext)
    if(selections.length < 1) {
      action.onOutput && action.onOutput([["No container selected"]], ActionOutputStyle.Text)
      return
    }
    this.selectedContainer = selections[0].name
  },

  async getServicePodLogs(actionContext: ActionContext, action: ActionSpec, tail: boolean) {
    action.onOutput && action.onOutput([["Pod", "Logs [Container: " + this.selectedContainer 
            + ", Service: " + this.selectedService.name + "]"]], ActionOutputStyle.Log)
    
    const pods = this.podsAndContainers.pods
    for(const i in pods) {
      action.showOutputLoading && action.showOutputLoading(true)
      const pod = pods[i]
      const logStream = await k8sFunctions.getPodLog(this.selectedNamespace, pod, 
                            this.selectedContainer, this.k8sClient, tail)
      logStream.onLog(lines => {
        lines = lines.split("\n")
                .filter(line => line.length > 0)
                .map(line => [pod, line])
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
    action.setScrollMode && action.setScrollMode(true)
    if(!this.selectedService) {
      this.storeSelectedService(actionContext, action)
      this.podsAndContainers = await k8sFunctions.getPodsAndContainersForService(
                            this.selectedNamespace, this.selectedService, this.k8sClient)
      if(this.podsAndContainers.containers.length > 1) {
        let containersShown = false
        await K8sPluginHelper.prepareChoices(actionContext, async () => {
          if(!containersShown) {
            containersShown = true
            return this.podsAndContainers.containers
          } else {
            return []
          }
        }, "Service Containers", 1, 1)
      } else {
        this.selectedContainer = this.podsAndContainers.containers[0]
        await this.getServicePodLogs(actionContext, action, tail)
      }
    } else {
      this.storeSelectedContainer(actionContext, action)
      await this.getServicePodLogs(actionContext, action, tail)
    }

  },

  async performChoose(actionContext: ActionContext, action: ActionSpec) {
    this.selectedService = undefined
    this.selectedCluster = undefined
    this.selectedNamespace = undefined
    this.selectedService = undefined
    this.selectedContainer = undefined
    this.k8sClient = undefined
    this.podsAndContainers = undefined
    action.stop && action.stop(actionContext)
    action.stopped = false
    await K8sPluginHelper.prepareChoices(actionContext, k8sFunctions.getNamespaceServices, "Services", 1, 1, "name")
  },

  actions: [
    {
      name: "Check Service Logs",
      order: 31,

      async choose(actionContext) {
        await plugin.performChoose(actionContext, this)
      },

      async act(actionContext) {
        await plugin.performAction(actionContext, this, false)
      }
    },
    {
      name: "Tail Service Logs",
      order: 32,

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
      }
    }
  ]
}

export default plugin