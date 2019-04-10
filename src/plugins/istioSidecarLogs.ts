import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import K8sFunctions from '../k8s/k8sFunctions';
import IstioFunctions from '../k8s/istioFunctions';
import {listResources} from './istioResources'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Sidecars Recipes",
  actions: [
    {
      name: "Tail Sidecar Logs",
      order: 11,
      selections: undefined,
      logStreams: [],

      choose: IstioPluginHelper.chooseSidecar.bind(IstioPluginHelper, 1, 5),

      async act(actionContext) {
        this.selections = IstioPluginHelper.getSelectedSidecars(actionContext)
        this.clear && this.clear(actionContext)
        this.setScrollMode && this.setScrollMode(true)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const selection of this.selections) {
          const cluster = actionContext.getClusters().filter(c => c.name === selection.cluster)[0]
          const logStream = await K8sFunctions.getPodLog(selection.namespace, selection.pod, 
                                    "istio-proxy", cluster.k8sClient, true, 50)
          logStream.onLog(lines => {
            lines = lines.split("\n")
                    .filter(line => line.length > 0)
                    .map(line => [selection.title, line])
            this.onStreamOutput && this.onStreamOutput(lines)
          })
          this.logStreams.push(logStream)
        }

        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear(actionContext) {
        const selectionsText = this.selections ? this.selections.map(s => 
                                  "["+s.title+"@"+s.cluster+"]")
                                  .join(", ") : ""
        this.onOutput && this.onOutput([["Sidecars Logs for: " + selectionsText]], ActionOutputStyle.Log)
      },
      stop(actionContext) {
        if(this.logStreams.length > 0) {
          this.logStreams.forEach(stream => stream.stop())
          this.logStreams = []
        }
      }
    }
  ]
}

export default plugin
