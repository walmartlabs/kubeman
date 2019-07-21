/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionContextOrder} from '../actions/actionSpec'
import ActionContext from '../actions/actionContext'
import K8sFunctions from '../k8s/k8sFunctions'
import ChoiceManager from '../actions/choiceManager'
import IstioFunctions from '../k8s/istioFunctions';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Ingress Recipes",
  actions: [
    {
      name: "Compare Ingress",
      order: 15,
      comparisonMap: {},
      loadingMessage: "Loading Clusters...",

      choose: ChoiceManager.chooseClusters.bind(ChoiceManager, 2, 2),
      
      async act(actionContext) {
        const clusters = ChoiceManager.getSelectedClusters(actionContext)
        if(clusters.length < 2) {
          this.onOutput && this.onOutput([["Not enough clusters to compare"]], ActionOutputStyle.Text)
          return
        }
        if(clusters.filter(c => !c.hasIstio).length > 0) {
          this.onOutput && this.onOutput([["Istio not installed on one or more clusters "]], ActionOutputStyle.Text)
          return
        }
      
        const headers = ["Istio IngressGateway Details"]
        clusters.forEach(cluster => headers.push(cluster.name))
        this.onOutput &&
          this.onOutput([headers], ActionOutputStyle.Compare)

        this.showOutputLoading && this.showOutputLoading(true)
        await this.compareDeployment(clusters, actionContext)
        await this.compareIngressComponents(clusters, actionContext)

        const rows: any[][] = []
        Object.keys(this.comparisonMap).forEach(key => {
          const row: any[] = []
          row.push(key)
          this.comparisonMap[key].forEach(value => row.push(value))
          rows.push(row)
        })
        this.onStreamOutput && this.onStreamOutput(rows)
        this.showOutputLoading && this.showOutputLoading(false)
      },


      addKeyComparison(key: string, objects: any[]) {
        this.comparisonMap[key] = []
        objects.forEach(o => this.comparisonMap[key].push(o[key]))
      },
      
      async compareDeployment(clusters: any[], actionContext: ActionContext) {
        const ingressDeployments: any[] = []
        for(const cluster of clusters) {
          const k8sClient = cluster.k8sClient
          const ingressDeployment = await K8sFunctions.getDeploymentDetails(cluster.name, 
                                      "istio-system", "istio-ingressgateway", k8sClient)
          if(!ingressDeployment) {
            this.onStreamOutput && this.onStreamOutput([["istio-ingressgateway not found", ""]])
          } else {
            ingressDeployments.push(ingressDeployment)
          }
        }
      
        this.addKeyComparison("replicas", ingressDeployments)
        this.addKeyComparison("availableReplicas", ingressDeployments.map(d => d.status))
        this.addKeyComparison("readyReplicas", ingressDeployments.map(d => d.status))
        const proxyContainers = ingressDeployments.map(deployment => 
          deployment.template.containers.filter(c => c.name === "istio-proxy" || c.name === 'ingressgateway')[0]||{})
        this.addKeyComparison("image", proxyContainers)
        this.addKeyComparison("ports", proxyContainers)
        this.addKeyComparison("resources", proxyContainers)
        
        const volumesAndMounts = ingressDeployments.map((deployment, i) => {
          return deployment.template.volumes ? {
            volumes:deployment.template.volumes.map(volume => {
              return {
                volume: volume.name,
                secret: volume.secret ? volume.secret.secretName : "",
                mountPath: proxyContainers[i].volumeMounts ? 
                            proxyContainers[i].volumeMounts.filter(mount => mount.name === volume.name)
                              .map(mount => mount.mountPath).join(" ") : ""
              }}) 
            } : {}
        })
        this.addKeyComparison("volumes", volumesAndMounts)
      },
      
      async compareIngressComponents(clusters: any[], actionContext: ActionContext) {
        this.comparisonMap["Ingress Service Type"] = []
        this.comparisonMap["Ingress Service IPs"] = []
        this.comparisonMap["Ingress Service Ports"] = []
        this.comparisonMap["Ingress Pods"] = []
        this.comparisonMap["Ingress Gateways"] = []
        this.comparisonMap["Ingress VirtualServices"] = []
        for(const cluster of clusters) {
          const k8sClient = cluster.k8sClient
          const ingressService = (await IstioFunctions.getIstioServiceDetails("istio=ingressgateway", k8sClient))[0]
          this.comparisonMap["Ingress Service Type"].push(ingressService.type)
          this.comparisonMap["Ingress Service IPs"].push({
            clusterIP: ingressService.clusterIP, 
            externalIPs: ingressService.externalIPs,
            loadBalancerIP: ingressService.loadBalancerIP,
            loadBalancerSourceRanges: ingressService.loadBalancerSourceRanges,
          })
          this.comparisonMap["Ingress Service Ports"].push(ingressService.ports)
            this.comparisonMap["Ingress Pods"].push(await IstioFunctions.getIngressGatewayPods(k8sClient))
          this.comparisonMap["Ingress Gateways"].push(await IstioFunctions.listAllIngressGateways(k8sClient, false))
          this.comparisonMap["Ingress VirtualServices"].push(await IstioFunctions.listAllIngressVirtualServices(k8sClient, false))
        }
      }
    }
  ]
}

export default plugin
