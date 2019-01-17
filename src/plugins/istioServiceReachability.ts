import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import K8sPluginHelper, {ItemSelection} from '../k8s/k8sPluginHelper'
import { PodDetails } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "Service Reachability From IngressGateway",
      order: 20,
      
      async choose(actionContext) {
        if(actionContext.getNamespaces().length === 0) {
          this.onOutput && this.onOutput(["No Namespace selected"], ActionOutputStyle.Text)
        } else {
          await K8sPluginHelper.prepareChoices(actionContext, K8sFunctions.getNamespaceServices, "Services", 1, 5, "name")
        }
      },

      async act(actionContext) {
        const selections: ItemSelection[] = await K8sPluginHelper.getSelections(actionContext, "name")
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No service selected"]], ActionOutputStyle.Text)
          return
        }
        this.onOutput && this.onOutput([["Service Reachability From IngressGateway"]], ActionOutputStyle.Log)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const selection of selections) {
          const service = selection.item
          const namespace = selection.namespace
          const cluster = actionContext.getClusters()
                              .filter(c => c.name === selection.cluster)[0]
          this.onStreamOutput && this.onStreamOutput([[">Service: " + service.name + ", Cluster: " + cluster.name]])
          if(!cluster.hasIstio) {
            this.onStreamOutput && this.onStreamOutput([["Istio not installed"]])
            continue
          }
          await IstioPluginHelper.checkServiceReachabilityFromIngress(service, namespace, cluster.k8sClient, this.onStreamOutput)
        }

        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
