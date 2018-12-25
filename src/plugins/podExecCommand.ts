import k8sFunctions from '../../src/k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, } from '../../src/actions/actionSpec'
import K8sPluginHelper from '../../src/util/k8sPluginHelper'


const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Actions",
  actions: [
    {
      name: "Execute Pod Command",
      order: 10,
      namespace: undefined,
      pod: undefined,
      container: undefined,
      k8sClient: undefined,
      
      choose: K8sPluginHelper.choosePod.bind(null, 1, 1, true, false),
      
      async act(actionContext) {
        const selections = await K8sPluginHelper.getPodSelections(actionContext)
        if(selections.length < 1) {
          actionContext.onOutput && actionContext.onOutput([["No pod selected"]], ActionOutputStyle.Text)
          return
        }
        const selection = selections[0]
        this.container = selection.container
        this.pod = selection.pod
        this.namespace = selection.namespace
        this.k8sClient = selection.k8sClient
        actionContext.onOutput && actionContext.onOutput([["Container@Pod: "+selection.title]], ActionOutputStyle.Log)
      },
      
      async react(actionContext) {
        const command = actionContext.inputText ? actionContext.inputText.split(" ") : []
        const result = await k8sFunctions.podExec(this.namespace, this.pod, this.container, this.k8sClient, command)
        actionContext.onStreamOutput && actionContext.onStreamOutput([[">"+ actionContext.inputText]])
        const output = result.length > 0 ? [[result]] : [["No Results"]]
        actionContext.onStreamOutput && actionContext.onStreamOutput(output)
      },
    }
  ]
}

export default plugin