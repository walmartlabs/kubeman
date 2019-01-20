import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, } from '../actions/actionSpec'
import K8sPluginHelper from '../k8s/k8sPluginHelper'


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",
  actions: [
    {
      name: "Execute Pod Command",
      order: 10,
      autoRefreshDelay: 15,
      selections: undefined,
      
      choose: K8sPluginHelper.choosePod.bind(K8sPluginHelper, 1, 5, true, false),
      
      async act(actionContext) {
        this.setScrollMode && this.setScrollMode(true)
        const selections = await K8sPluginHelper.getPodSelections(actionContext)
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No pod selected"]], ActionOutputStyle.Text)
          return
        }
        this.selections = selections
        this.onOutput && this.onOutput([[
          "Send Command To: " + selections.map(s => s.title).join(", ")
        ]], ActionOutputStyle.Log)
      },
      
      async react(actionContext) {
        this.showOutputLoading && this.showOutputLoading(true)
        if(actionContext.inputText && actionContext.inputText.includes("ping")
          && !actionContext.inputText.includes("-c")) {
            this.onStreamOutput && this.onStreamOutput([["Can't execute ping command without -c option since this will run indefinitely."]])
            this.showOutputLoading && this.showOutputLoading(false)
            return
        }
        const command = actionContext.inputText ? actionContext.inputText.split(" ") : []
        for(const selection of this.selections) {
          try {
            const result = await k8sFunctions.podExec(selection.namespace, selection.pod, 
                                  selection.container, selection.k8sClient, command)
            this.onStreamOutput && this.onStreamOutput([[">Pod: "+ selection.title + ", Command: " + actionContext.inputText]])
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
    }
  ]
}

export default plugin