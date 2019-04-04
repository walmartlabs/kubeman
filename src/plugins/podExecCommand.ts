import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, } from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",
  actions: [
    {
      name: "Execute Pod Command",
      order: 25,
      autoRefreshDelay: 15,
      loadingMessage: "Loading Containers@Pods...",

      selections: undefined,
      
      choose: ChoiceManager.choosePod.bind(ChoiceManager, 1, 10, true, false),
      
      async act(actionContext) {
        const selections = await ChoiceManager.getPodSelections(actionContext)
        this.selections = selections
        this.clear && this.clear(actionContext)
        this.setScrollMode && this.setScrollMode(true)
      },
      
      async react(actionContext) {
        const inputText = actionContext.inputText ? actionContext.inputText : ''
        const separator = inputText.includes("&&") ? "&&" : "&"
        const commands = inputText.split(separator).map(c => c.trim())
                            .map(c => c.startsWith("/") ? c.slice(1) : c)
        for(const command of commands) {
          await this.executeCommand(command, actionContext)
        }
      },      
      async executeCommand(commandText, actionContext) {
        if(commandText.includes("ping") && !commandText.includes("-c")) {
            this.onStreamOutput && this.onStreamOutput([["Can't execute ping command without -c option since this will run indefinitely."]])
            this.showOutputLoading && this.showOutputLoading(false)
            return
        }
        if(commandText.includes("top")) {
          this.onStreamOutput && this.onStreamOutput([[commandText + ": can't execute a command that runs indefinitely"]])
          this.showOutputLoading && this.showOutputLoading(false)
          return
        }
        if(commandText.includes("rm") || commandText.includes("rmdir")) {
          this.onStreamOutput && this.onStreamOutput([[commandText + ": prohibited command"]])
          this.showOutputLoading && this.showOutputLoading(false)
          return
        }
        if(commandText === "clear" || commandText === "c") {
          this.clear && this.clear(actionContext)
          return
        }
        this.showOutputLoading && this.showOutputLoading(true)
        const command = commandText.split(" ")
        for(const selection of this.selections) {
          try {
            const result = await k8sFunctions.podExec(selection.namespace, selection.pod, 
                                  selection.container, selection.k8sClient, command)
            this.onStreamOutput && this.onStreamOutput([[">Pod: "+ selection.title+"."+selection.namespace 
                                  + ", Command: " + commandText]])
            const output = result.length > 0 ? [[result]] : [["No Results"]]
            this.onStreamOutput && this.onStreamOutput(output)
          } catch(error) {
            this.onStreamOutput && this.onStreamOutput([[
              "Error for pod " + selection.title + ": " + error.message
            ]])
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.react && this.react(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([[
          "Send Command To: " + this.selections.map(s => s.title+"."+s.namespace).join(", ")
        ]], ActionOutputStyle.Log)
      },
    }
  ]
}

export default plugin