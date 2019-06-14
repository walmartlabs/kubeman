/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import K8sFunctions from '../k8s/k8sFunctions'
import ChoiceManager from '../actions/choiceManager';
import {ActionGroupSpec, ActionContextType, ActionContextOrder,
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'
import { Namespace } from '../k8s/k8sObjectTypes';


export function generateServiceComparisonOutput(clusters, namespaces, clusterServices) {
  const output: ActionOutput = []
  const nsServiceToClusterMap = {}
  namespaces.forEach(ns => {
    const namespace = ns.name
    if(!nsServiceToClusterMap[namespace]) {
      nsServiceToClusterMap[namespace] = {}
    }
    Object.keys(clusterServices).forEach(cluster => {
      const clusterNSServices = clusterServices[cluster][namespace]
      clusterNSServices && 
        clusterNSServices.forEach(service => {
          if(!nsServiceToClusterMap[namespace][service]) {
            nsServiceToClusterMap[namespace][service] = {}
          }
          nsServiceToClusterMap[namespace][service][cluster] = true
        })
    })
  })

  Object.keys(nsServiceToClusterMap).forEach(namespace => {
    const groupTitle = [">Namespace: " + namespace]
    clusters.forEach(cluster => {
      groupTitle.push("")
    })
    output.push(groupTitle)
    const serviceToClusterMap = nsServiceToClusterMap[namespace]
    const services = serviceToClusterMap ? Object.keys(serviceToClusterMap) : []
    if(services.length === 0) {
      output.push(["No Services", ...clusters.map(() => "")])
    } else {
      services.forEach(service => {
        const clusterMap = serviceToClusterMap[service]
        const row = [service]
        clusters.forEach(cluster => {
          row.push(clusterMap[cluster.name] ? "Yes" : "No")
        })
        output.push(row)
      })
    }
  })
  return output
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Service Recipes",
  order: ActionContextOrder.Service,
  actions: [
    {
      name: "Compare Namespace Services",
      order: 10,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, true, 1, 10),

      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const headers: string[] = ["Namespace/Service"]
        clusters.forEach(cluster => {
          headers.push("Cluster: " + cluster.name)
        })
        this.onOutput && this.onOutput([headers], ActionOutputStyle.Compare)
        this.showOutputLoading && this.showOutputLoading(true)
        const selections = await ChoiceManager.getSelections(actionContext)
        const namespaces = selections.map(s => s.item) as Namespace[]

        const clusterServices = await K8sFunctions.getServicesGroupedByClusterNamespace(clusters, namespaces)

        const output = generateServiceComparisonOutput(clusters, namespaces, clusterServices)
        this.onStreamOutput && this.onStreamOutput(output)
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
