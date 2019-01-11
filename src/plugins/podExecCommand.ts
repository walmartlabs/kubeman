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
      namespace: undefined,
      pod: undefined,
      container: undefined,
      k8sClient: undefined,
      
      choose: K8sPluginHelper.choosePod.bind(K8sPluginHelper, 1, 1, true, false),
      
      async act(actionContext) {
        this.setScrollMode && this.setScrollMode(true)
        const selections = await K8sPluginHelper.getPodSelections(actionContext)
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No pod selected"]], ActionOutputStyle.Text)
          return
        }
        const selection = selections[0]
        this.container = selection.container
        this.pod = selection.pod
        this.namespace = selection.namespace
        this.k8sClient = selection.k8sClient
        this.onOutput && this.onOutput([["Container@Pod: "+selection.title]], ActionOutputStyle.Log)
      },
      
      async react(actionContext) {
        this.showOutputLoading && this.showOutputLoading(true)
        const command = actionContext.inputText ? actionContext.inputText.split(" ") : []
        try {
          const result = await k8sFunctions.podExec(this.namespace, this.pod, this.container, this.k8sClient, command)
          this.onStreamOutput && this.onStreamOutput([[">"+ actionContext.inputText]])
          const output = result.length > 0 ? [[result]] : [["No Results"]]
          this.onStreamOutput && this.onStreamOutput(output)
        } catch(error) {
          this.onStreamOutput && this.onStreamOutput([[
            "Error for pod " + this.pod + ": " + error.message
          ]])
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin