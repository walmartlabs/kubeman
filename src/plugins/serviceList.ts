/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextOrder, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import K8sFunctions from '../k8s/k8sFunctions'
import { Namespace } from '../k8s/k8sObjectTypes';

function outputServices(services: any[], output) {
  services.length === 0 && output.push(["No services found"])
  services.forEach(service => {
    output.push([">>>"+service.name+"."+service.namespace], [service.yaml])
  })
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Service Recipes",
  order: ActionContextOrder.Service,
  actions: [
    {
      name: "List Cluster Services",
      order: 1,

      async act(actionContext) {
        this.onOutput && this.onOutput([["Cluster Services"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          this.onStreamOutput && this.onStreamOutput([[">Cluster: "+cluster.name]])
          let clusterNamespaces = await K8sFunctions.getClusterNamespaces(cluster.k8sClient)
          for(const namespace of clusterNamespaces) {
            const output: ActionOutput = []
            output.push([">>Namespace: "+namespace.name])
            outputServices(await K8sFunctions.getServices(cluster.name, namespace.name, cluster.k8sClient), output)
            this.onStreamOutput && this.onStreamOutput(output)
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
    {
      name: "List Namespace Services",
      order: 2,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, false, 1, 10),

      async act(actionContext) {
        this.onOutput && this.onOutput([["Namespace Services"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        const selections = await ChoiceManager.getSelections(actionContext)
        for(const cluster of clusters) {
          this.onStreamOutput && this.onStreamOutput([[">Cluster: "+cluster.name]])
          let clusterNamespaces = selections.filter(s => s.cluster === cluster.name).map(s => s.item) as Namespace[]
          for(const namespace of clusterNamespaces) {
            const output: ActionOutput = []
            output.push([">>Namespace: "+namespace.name])
            outputServices(await K8sFunctions.getServices(cluster.name, namespace.name, cluster.k8sClient), output)
            this.onStreamOutput && this.onStreamOutput(output)
          }
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
    {
      name: "List All External Services",
      order: 3,

      async act(actionContext) {
        this.onOutput && this.onOutput([["External Services"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          const output: ActionOutput = []
          output.push([">Cluster: "+cluster.name])

          const externalServices = await K8sFunctions.getClusterExternalServices(cluster.k8sClient)
          externalServices.length === 0 && output.push(["No external services found"])

          let clusterNamespaces = await K8sFunctions.getClusterNamespaces(cluster.k8sClient)
          for(const namespace of clusterNamespaces) {
            const nsServices = externalServices.filter(s => s.namespace === namespace.name)
            nsServices.length > 0 && output.push([">>Namespace: "+namespace.name])
            nsServices.forEach(service => {
              output.push([">>>"+service.name+"."+service.namespace], [service.yaml])
            })
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
