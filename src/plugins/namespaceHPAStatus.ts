/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import ChoiceManager from '../actions/choiceManager'
import KubectlClient from '../k8s/kubectlClient'
import K8sFunctions from '../k8s/k8sFunctions'
import {outputHPAStatus} from './clusterHPAStatus'

export function outputReplicaSetStatus(replicaSetStatus: any[], output: ActionOutput) {
  if(replicaSetStatus && replicaSetStatus.length > 0) {
    const rsOutput: any [][] = []
    rsOutput.push([])
    rsOutput[0].push("##Name")
    rsOutput[0].push("Current / Desired Replicas")
    rsOutput[0].push("Available / Ready / Fully Labeled Replicas")
    rsOutput[0].push("Observed Generation")
    rsOutput[0].push("Age")

    replicaSetStatus.forEach(hpa => {
      const row: any [] = []
      row.push(hpa["name"])
      row.push(hpa["currentReplicas"] + "/" + hpa["desiredReplicas"])
      row.push((hpa["availableReplicas"]||" ") + "/" + (hpa["readyReplicas"]||" ") + "/" + (hpa["fullyLabeledReplicas"]||" "))
      row.push(hpa["observedGeneration"])
      row.push(hpa["age"])
      rsOutput.push(row)
    })
    output.push(rsOutput)
  }
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Namespace Recipes",

  actions: [
    {
      name: "Namespace HPA Status",
      order: 30,
      loadingMessage: "Loading Namespaces...",

      choose: ChoiceManager.chooseNamespaces.bind(ChoiceManager, false, 1, 3),
      
      async act(actionContext) {
        const namespaces = await ChoiceManager.getSelections(actionContext).map(s => s.item)
        this.directAct && this.directAct(namespaces)
      },

      async directAct(namespaces) {
        this.onOutput && this.onOutput([["Namespace HPA Status"]], ActionOutputStyle.Mono)
        this.showOutputLoading && this.showOutputLoading(true)
        const clusters = this.actionContext.getClusters()
        for(const namespace of namespaces) {
          const output: ActionOutput = []
          const cluster = clusters.filter(c => c.name === namespace.cluster.name)[0]
          output.push([">Namespace " + namespace.name + ", Cluster: " + cluster.name])
          output.push([">>Namespace HPA Status"])
          if(cluster.hasKubectl) {
            const {hpaStatus, replicasetStatus} = await KubectlClient.getHPAStatus(cluster, namespace.name)
            hpaStatus.forEach(item => output.push(["<<", ...item]))
            replicasetStatus && output.push([">>Namespace ReplicaSets Status"])
            replicasetStatus && replicasetStatus.forEach(item => output.push(["<<", ...item]))
          } else {
            const result = await K8sFunctions.getHPAStatus(cluster.k8sClient, namespace.name)
            const hpaStatus = result ? result.hpaStatus : undefined
            hpaStatus && outputHPAStatus(hpaStatus, output)
            const replicasetStatus = result ? result.replicasetStatus : undefined
            replicasetStatus && output.push([">>Namespace ReplicaSets Status"])
            replicasetStatus && outputReplicaSetStatus(replicasetStatus, output)
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([["Namespace HPA Status"]], ActionOutputStyle.Mono)
      },
    },
  ]
}

export default plugin
