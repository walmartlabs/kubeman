/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextOrder, ActionContextType, ActionOutputStyle, ActionOutput} from '../actions/actionSpec'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import K8sFunctions from '../k8s/k8sFunctions'
import K8sPluginHelper from '../k8s/k8sPluginHelper'
import { PodDetails } from '../k8s/k8sObjectTypes';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Service Recipes",
  order: ActionContextOrder.Service,
  actions: [
    {
      name: "View Service Details",
      order: 20,
      loadingMessage: "Loading Services...",
      
      choose: ChoiceManager.chooseService.bind(ChoiceManager, 1, 10),

      async act(actionContext) {
        const selections: ItemSelection[] = await ChoiceManager.getServiceSelections(actionContext)
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No service selected"]], ActionOutputStyle.Text)
          return
        }
        this.onOutput && this.onOutput([["Service Details"]], ActionOutputStyle.Table)

        for(const selection of selections) {
          const service = selection.item
          const cluster = actionContext.getClusters().filter(c => c.name === selection.cluster)[0]
          const output: ActionOutput = []
          output.push([">" + service.name+"."+service.namespace + " @ " + cluster.name])
          output.push([">>Service"], [service.yaml])

          const podsAndContainers = await K8sFunctions.getPodsAndContainersForService(service, cluster.k8sClient, true)
          const pods: PodDetails[] = podsAndContainers && podsAndContainers.pods ? podsAndContainers.pods as PodDetails[] : []
          const nodeLocality = {}
          for(const pod of pods) {
            if(pod.nodeName && !nodeLocality[pod.nodeName]) {
              const node = await K8sFunctions.getNodeDetails(pod.nodeName, cluster.k8sClient)
              if(node) {
                nodeLocality[node.name] = {
                  region: node.labels["failure-domain.beta.kubernetes.io/region"],
                  zone: node.labels["failure-domain.beta.kubernetes.io/zone"]
                }
              }
            }
          }

          output.push([">>Service Endpoints"])
          const endpointSubsets = await K8sFunctions.getServiceEndpoints(service.name, service.namespace, cluster.k8sClient)
          const subsetCount = endpointSubsets.length
          const endpointPods = {}

          const getEndpointInfo = (endpoint) => {
            const pod = pods.filter(pod => pod.podIP && pod.podIP === endpoint.ip)[0]
            const node = pod && pod.nodeName
            const podInfo = {
              pod: endpoint.targetRef.name, 
              ip: endpoint.ip,
              node,
              locality: node && nodeLocality[node]
            }
            return podInfo
          }
          endpointSubsets.forEach((subset, i) => {
            const readyPods: any[] = []
            subset.addresses && subset.addresses.forEach(a => {
              const podInfo = getEndpointInfo(a)
              readyPods.push(podInfo)
              endpointPods[a.targetRef.name] = podInfo
            })
            if(readyPods.length > 0) {
              output.push([">>>Ready Endpoints " + (subsetCount > 1 ? "Subset #"+(i+1):"")])
              output.push([readyPods])
            }
            const notReadyPods: any[] = []
            subset.notReadyAddresses && subset.notReadyAddresses.forEach(a => {
              const podInfo = getEndpointInfo(a)
              notReadyPods.push(podInfo)
              endpointPods[a.targetRef.name] = podInfo
            })
            if(notReadyPods.length > 0) {
              output.push([">>>Not Ready Endpoints " + (subsetCount > 1 ? "Subset #"+(i+1):"")])
              output.push([notReadyPods])
            }
          })

          const podsByLocality = {}
          Object.keys(endpointPods).forEach(podName => {
            const epInfo = endpointPods[podName]
            const region = epInfo.locality.region || "N/A"
            const zone = epInfo.locality.zone || "N/A"
            podsByLocality[region] = podsByLocality[region] || {}
            podsByLocality[region][zone] = podsByLocality[region][zone] || []
            podsByLocality[region][zone].push(podName)
          })
          output.push([">>Service Endpoints by Locality"])
          Object.keys(podsByLocality).forEach(region => {
            Object.keys(podsByLocality[region]).forEach(zone => {
              const podsList = podsByLocality[region][zone] || []
              output.push([">>>Region: " + region + ", Zone: " + zone + " (count: " + podsList.length + ")"])
              output.push([podsList])
            })
          })

          output.push([">>Service Pods Details"])
          if(pods.length > 0) {
            pods.forEach(pod => {
              const epInfo = endpointPods[pod.name] 
              output.push([">>>"+pod.name +
                (epInfo ? ", Endpoint IP: ["+epInfo.ip+"]" : " (pod not found in service endpoints)")], 
              [pod.yaml])
            })
          } else {
            output.push(["No pods found for the service"])
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Compare Two Services",
      order: 21,
      loadingMessage: "Loading Services...",

      choose: ChoiceManager.chooseService.bind(ChoiceManager, 2, 2),

      async act(actionContext) {
        K8sPluginHelper.generateComparisonOutput(this, actionContext, 
            ChoiceManager.getServiceSelections.bind(ChoiceManager), this.onOutput, this.onStreamOutput, "Services")
      },
    }
  ]
}

export default plugin
