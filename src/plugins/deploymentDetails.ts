import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import K8sPluginHelper, {ItemSelection} from '../k8s/k8sPluginHelper'
import k8sFunctions from '../k8s/k8sFunctions'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  actions: [
    {
      name: "View Deployment Details",
      order: 3,
      
      async choose(actionContext) {
        await K8sPluginHelper.prepareChoices(actionContext, k8sFunctions.getNamespaceDeployments, 
                                          "Deployments", 1, 10, true, "name")
      },

      async act(actionContext) {
        const selections: ItemSelection[] = await K8sPluginHelper.getSelections(actionContext, "name")
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No service selected"]], ActionOutputStyle.Text)
          return
        }
        this.onOutput && this.onOutput([["Keys", "Data"]], ActionOutputStyle.Table)

        selections.forEach(selection => {
          const output: ActionOutput = []
          output.push([">" + selection.title, ""])
          output.push(["cluster", selection.cluster])
          const item = selection.item
          if(item) {
            Object.keys(item).forEach((key, index) => output.push([key, item[key] ||'']))
          }
          this.onStreamOutput && this.onStreamOutput(output)
        })
      },
    }
  ]
}

export default plugin
