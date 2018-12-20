import k8sFunctions from '../../src/k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
      ActionOutput, ActionOutputStyle, } from '../../src/actions/actionSpec'
import K8sPluginHelper from '../util/k8sPluginHelper'
import {Namespace, Pod, PodTemplate} from "../../src/k8s/k8sObjectTypes"
import ActionContext from '../../src/actions/actionContext';
import { any } from 'prop-types';
import contextMenu from '../../src/main/contextMenu';


const plugin : ActionGroupSpec = {
  context: ActionContextType.Pod,

  logStream: undefined,

  async getPodLogs(actionContext: ActionContext, tail: boolean) {
    let selections = actionContext.getSelections()
    if(selections.length < 1) {
      actionContext.onOutput && actionContext.onOutput([["No pod selected"]], ActionOutputStyle.Text)
      return
    }
    const title = selections[0][0] as string
    const podAndContainer = title.split("@")
    const container = podAndContainer[0]
    const pod = podAndContainer[1]
    const namespace = selections[0][1].replace("Namespace: ", "")
    const cluster = selections[0][2].replace("Cluster: ", "")
  
    const clusters = actionContext.getClusters()
    const clusterIndex = clusters.map((c,i) => c.name === cluster ? i : -1)
            .filter(i => i >= 0)[0]
    const k8sClient = actionContext.getK8sClients()[clusterIndex]
    
    actionContext.onOutput && actionContext.onOutput([["Logs for " + title]], ActionOutputStyle.Log)
  
    const logStream = await k8sFunctions.getPodLog(namespace, pod, container, k8sClient, tail)
    logStream.onLog(lines => {
      lines = lines.split("\n")
              .filter(line => line.length > 0)
              .map(line => [line])
      actionContext.onStreamOutput && actionContext.onStreamOutput(lines)
    })
    if(tail) {
      this.logStream = logStream
    } else {
      setTimeout(() => {
        logStream.stop()
      }, 10000)
    }
  },

  actions: [
    {
      name: "Check Pod Logs",
      order: 1,
      choose: K8sPluginHelper.choosePod,
      async act(actionContext) {
        await plugin.getPodLogs(actionContext, false)
      }
    },
    {
      name: "Tail Pod Logs",
      order: 2,
      choose: K8sPluginHelper.choosePod,
      async act(actionContext) {
        await plugin.getPodLogs(actionContext, true)
      },
      stop(actionContext) {
        console.log("closing log stream...")
        if(plugin.logStream) {
          plugin.logStream.stop()
          plugin.logStream = undefined
        }
      }
    }
  ]
}

export default plugin