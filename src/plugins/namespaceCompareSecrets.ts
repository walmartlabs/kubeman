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

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Resources",
  order: ActionContextOrder.Resources,
  actions: [
    {
      name: "List/Compare Secrets",
      order: 5,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, true, 1, 10),

      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const headers = ["Namespace/Secret"]
        clusters.forEach(cluster => {
          headers.push("Cluster: " + cluster.name)
        })
        this.onOutput && this.onOutput([headers], ActionOutputStyle.Compare)

        this.showOutputLoading && this.showOutputLoading(true)
        const selections = await ChoiceManager.getSelections(actionContext)
        const namespaces = selections.map(s => s.item) as Namespace[]

        const secretsMap = {}
        const secretIndexToNameMap = {}
        for(const namespace of namespaces) {
          if(!secretsMap[namespace.name]) {
            secretsMap[namespace.name] = {}
          }
          for(const cluster of clusters) {
            const secrets = await K8sFunctions.getNamespaceSecrets(namespace.cluster.name, namespace.name, cluster.k8sClient)
            secrets.forEach(secret => {
              let secretIndexName = secret.name
              const firstDash = secret.name.indexOf('-') 
              const lastDash = secret.name.lastIndexOf('-')
              if(firstDash > 0 && lastDash > 0 && firstDash !== lastDash) {
                secretIndexName = secret.name.slice(0, lastDash)
                secret.name = secretIndexName+"-..."
              }
              if(!secretsMap[namespace.name][secretIndexName]) {
                secretsMap[namespace.name][secretIndexName] = {}
              }
              secretsMap[namespace.name][secretIndexName][cluster.name] = true
              secretIndexToNameMap[secretIndexName] = secret.name
            })
          }
        }

        const output: ActionOutput = []
        Object.keys(secretsMap).forEach(namespace => {
          const groupTitle = [">Namespace: " + namespace]
          clusters.forEach(cluster => {
            groupTitle.push("")
          })
          output.push(groupTitle)
          const secretToClusterMap = secretsMap[namespace]
          const secrets = secretToClusterMap ? Object.keys(secretToClusterMap) : []
          if(secrets.length === 0) {
            output.push(["No Secrets", ...clusters.map(() => "")])
          } else {
            secrets.forEach(secretIndex => {
              const clusterMap = secretToClusterMap[secretIndex]
              const row = [secretIndexToNameMap[secretIndex]]
              clusters.length > 1 && clusters.forEach(cluster => {
                row.push(clusterMap[cluster.name] ? "Yes" : "No")
              })
              output.push(row)
            })
          }
        })
        this.onStreamOutput && this.onStreamOutput(output)
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
