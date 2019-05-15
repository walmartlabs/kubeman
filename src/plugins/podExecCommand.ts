import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, } from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'
import { K8sClient } from '../k8s/k8sClient'

export interface PodContainerInfo {
  container: string
  pod: string
  namespace: string
  cluster: string
  k8sClient: K8sClient
}

export async function executeCommand(containerList: PodContainerInfo[], actionContext, clear, onStreamOutput) {
  const inputText = actionContext.inputText ? actionContext.inputText : ''
  const separator = inputText.includes("&&") ? "&&" : "&"
  const commands = inputText.split(separator).map(c => c.trim())
                      .map(c => c.startsWith("/") ? c.slice(1) : c)

  for(const c of commands) {
    const commandText = c.trim()
    if(commandText.length === 0) {
      onStreamOutput([["No command entered."]])
      continue
    }
    if(commandText.includes("ping") && !commandText.includes("-c")) {
        onStreamOutput([["Can't execute ping command without -c option since this will run indefinitely."]])
        continue
    }
    if(commandText.includes("top")) {
      onStreamOutput([[commandText + ": can't execute a command that runs indefinitely"]])
      continue
    }
    if(commandText.includes("rm") || commandText.includes("rmdir")) {
      onStreamOutput([[commandText + ": prohibited command"]])
      continue
    }
    if(commandText === "clear" || commandText === "c") {
      clear(actionContext)
      continue
    }
    onStreamOutput([[">Command: " + commandText]])
    const command = ["sh", "-c", commandText]
    for(const c of containerList) {
      const output: ActionOutput = []
      const title = c.container+"@"+c.pod+"."+c.namespace+" @ "+c.cluster
      try {
        const result = await k8sFunctions.podExec(c.namespace, c.pod, 
                              c.container, c.k8sClient, command)
        output.push([">>Container@Pod @ Cluster :  "+  title])
        output.push(result.length > 0 ? [result] : ["No Results"])
        onStreamOutput(output)
      } catch(error) {
        onStreamOutput([[
          "Error for container " + title + ": " + error.message
        ]])
      }
    }
  }
}


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",
  actions: [
    {
      name: "Execute Pod Command",
      order: 25,
      autoRefreshDelay: 15,
      loadingMessage: "Loading Containers@Pods...",

      podsList: [],
      
      choose: ChoiceManager.choosePods.bind(ChoiceManager, 1, 10, true, false),
      
      async act(actionContext) {
        this.showOutputLoading && this.showOutputLoading(true)
        this.podsList = []
        const selections = await ChoiceManager.getPodSelections(actionContext)
        this.podsList = this.podsList.concat(
          selections.map(s => {
            return {
              container: s.containerName,
              pod: s.podName,
              namespace: s.namespace,
              cluster: s.cluster,
              k8sClient: s.k8sClient
            }
          }))

        this.clear && this.clear(actionContext)
        this.setScrollMode && this.setScrollMode(true)
        this.showOutputLoading && this.showOutputLoading(false)
      },
      
      async react(actionContext) {
        this.showOutputLoading && this.showOutputLoading(true)
        await executeCommand(this.podsList, actionContext, this.clear, this.onStreamOutput)
        this.showOutputLoading && this.showOutputLoading(false)
      },      
      refresh(actionContext) {
        this.react && this.react(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([[
          "Send Command To: " + this.podsList.map(p => " [ " + p.container+"@"+p.pod+"."+p.namespace+" @ "+p.cluster + " ] ").join(", ")
        ]], ActionOutputStyle.Log)
      },
    }
  ]
}

export default plugin