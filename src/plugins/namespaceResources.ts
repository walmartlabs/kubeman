/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import ChoiceManager from '../actions/choiceManager'
import { K8sClient } from '../k8s/k8sClient'

export async function listResources(type: string, namespace: string, k8sClient: K8sClient,
              getResources: (namespace, k8sClient) => Promise<any[]>, onStreamOutput) {
  const output: ActionOutput = [[">>"+type]]
  const items = await getResources(namespace, k8sClient)
  items.forEach(item => {
    output.push([">>>"+item.name])
    output.push([item.yaml])
  })
  items.length === 0 && output.push(["No "+type])
  onStreamOutput(output)
}

export async function outputConfigMaps(namespace: string, k8sClient: K8sClient, onStreamOutput, showData: boolean = false) {
  await listResources("ConfigMaps", namespace, k8sClient, 
  async (namespace, k8sClient) => {
    return (await K8sFunctions.getNamespaceConfigMaps('', namespace, k8sClient))
            .map(c => {
              return {
                name: c.name,
                yaml: {
                  name: c.name,
                  namespace: c.namespace,
                  creationTimestamp: c.creationTimestamp,
                  labels: c.labels,
                  annotations: c.annotations,
                  data: showData ? c.data : undefined
                }
              }
            })
  }, onStreamOutput)
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Namespace Recipes",

  actions: [
    {
      name: "View All Resources in a Namespace",
      order: 20,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, false, 1, 3),
      
      async act(actionContext) {
        const namespaces = await ChoiceManager.getSelections(actionContext).map(s => s.item)
        this.directAct && this.directAct(namespaces)
      },

      async directAct(namespaces) {
        this.onOutput && this.onOutput([["Namespace Resources"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        const clusters = this.actionContext.getClusters()
        for(const namespace of namespaces) {
          const cluster = clusters.filter(c => c.name === namespace.cluster.name)[0]
          
          this.onStreamOutput && this.onStreamOutput([[">Namespace " + namespace.name + ", Cluster: " + cluster.name]])

          await listResources("Services", namespace.name, cluster.k8sClient, 
                K8sFunctions.getServicesWithDetails.bind(K8sFunctions), this.onStreamOutput)

          await listResources("Deployments", namespace.name, cluster.k8sClient, 
                K8sFunctions.getNamespaceDeployments.bind(K8sFunctions, cluster.name), this.onStreamOutput)

          await listResources("StatefulSets", namespace.name, cluster.k8sClient, 
                K8sFunctions.getNamespaceStatefulSets.bind(K8sFunctions, cluster.name), this.onStreamOutput)

          await listResources("Pods", namespace.name, cluster.k8sClient, 
                K8sFunctions.getAllPodsForNamespace.bind(K8sFunctions), this.onStreamOutput)

          await listResources("ServiceEntries", namespace.name, cluster.k8sClient, 
                IstioFunctions.getNamespaceServiceEntries.bind(IstioFunctions), this.onStreamOutput)

          await listResources("Gateways", namespace.name, cluster.k8sClient, 
                IstioFunctions.getNamespaceGateways.bind(IstioFunctions), this.onStreamOutput)

          await listResources("VirtualServices", namespace.name, cluster.k8sClient, 
                IstioFunctions.getNamespaceVirtualServices.bind(IstioFunctions), this.onStreamOutput)

          await listResources("Policies", namespace.name, cluster.k8sClient, 
                IstioFunctions.getNamespacePolicies.bind(IstioFunctions), this.onStreamOutput)

          await listResources("DestinationRules", namespace.name, cluster.k8sClient, 
                IstioFunctions.getNamespaceDestinationRules.bind(IstioFunctions), this.onStreamOutput)

          await listResources("Sidecar Configs", namespace.name, cluster.k8sClient, 
                IstioFunctions.getNamespaceSidecarConfigs.bind(IstioFunctions), this.onStreamOutput)

          await listResources("Rules", namespace.name, cluster.k8sClient, 
                IstioFunctions.getNamespaceRules.bind(IstioFunctions), this.onStreamOutput)

          await listResources("Secrets", namespace.name, cluster.k8sClient,
                async (namespace, k8sClient) => {
                  return (await K8sFunctions.getNamespaceSecrets(cluster.name, namespace, k8sClient))
                          .map(s => {
                            return {
                              name: s.name,
                              yaml: {
                                name: s.name,
                                namespace: s.namespace,
                                creationTimestamp: s.creationTimestamp,
                                labels: s.labels,
                                annotations: s.annotations,
                              }
                            }
                          })
                }, this.onStreamOutput)

          await outputConfigMaps(namespace.name, cluster.k8sClient, this.onStreamOutput)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
    },
    {
      name: "View Namespace ConfigMaps",
      order: 21,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, false, 1, 1),
      
      async act(actionContext) {
        const namespaces = await ChoiceManager.getSelections(actionContext).map(s => s.item)
        this.directAct && this.directAct(namespaces)
      },

      async directAct(namespaces) {
        this.onOutput && this.onOutput([["Namespace ConfigMaps"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)
        const clusters = this.actionContext.getClusters()
        for(const namespace of namespaces) {
          const cluster = clusters.filter(c => c.name === namespace.cluster.name)[0]
          
          this.onStreamOutput && this.onStreamOutput([[">Namespace " + namespace.name + ", Cluster: " + cluster.name]])

          await outputConfigMaps(namespace.name, cluster.k8sClient, this.onStreamOutput, true)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      }
    },
  ]
}

export default plugin
