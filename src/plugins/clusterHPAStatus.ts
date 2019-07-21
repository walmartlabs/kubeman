/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import KubectlClient from '../k8s/kubectlClient'
import K8sFunctions from '../k8s/k8sFunctions';

export function outputHPAStatus(hpaStatus: any[], output: ActionOutput) {
  if(hpaStatus && hpaStatus.length > 0) {
    const hpaOutput: any [][] = []
    hpaOutput.push([])
    hpaOutput[0].push("##Name")
    hpaOutput[0].push("Reference")
    hpaOutput[0].push("Min/Max Replicas")
    hpaOutput[0].push("Current / Desired Replicas")
    hpaOutput[0].push("Current / Target CPU")
    hpaOutput[0].push("Last Scale Time")
    hpaOutput[0].push("Age")

    hpaStatus.forEach(hpa => {
      const row: any [] = []
      row.push(hpa["name"])
      row.push(hpa["reference"])
      row.push(hpa["minReplicas"] + "/" + hpa["maxReplicas"])
      row.push(hpa["currentReplicas"] + "/" + hpa["desiredReplicas"])
      row.push(hpa["currentCPUUtilizationPercentage"] + "/" + hpa["targetCPUUtilizationPercentage"])
      row.push(hpa["lastScaleTime"])
      row.push(hpa["age"])
      hpaOutput.push(row)
    })
    output.push(hpaOutput)
  }
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,

  actions: [
    {
      name: "Cluster HPA Status",
      order: 10,

      async act(actionContext) {
        this.clear && this.clear(actionContext)
        this.showOutputLoading && this.showOutputLoading(true)
        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          const output: ActionOutput = []
          output.push([">Cluster: " + cluster.name])
          if(cluster.hasKubectl) {
            const {hpaStatus} = await KubectlClient.getHPAStatus(cluster)
            hpaStatus && hpaStatus.forEach(item => output.push(["<<", ...item]))
          } else {
            const result = await K8sFunctions.getHPAStatus(cluster.k8sClient)
            const hpaStatus = result ? result.hpaStatus : undefined
            hpaStatus && outputHPAStatus(hpaStatus, output)
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([["Cluster HPA Status"]], ActionOutputStyle.Mono)
      },
    },
  ]
}

export default plugin
