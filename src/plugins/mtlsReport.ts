/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import { MtlsUtil } from '../k8s/mtlsUtil';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Analysis Recipes",
  order: ActionContextOrder.Analysis,
  actions: [
    {
      name: "Cluster mTLS Report",
      order: 3,
      
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput &&
          this.onOutput([["", "Istio MTLS Enabled Status"]], ActionOutputStyle.Table)

        this.showOutputLoading && this.showOutputLoading(true)

        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name, ""]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["", "Istio not installed"]])
            continue
          }
          const output: ActionOutput = []
          const k8sClient = cluster.k8sClient

          const globalMtlsStatus = await MtlsUtil.getGlobalMtlsStatus(cluster.k8sClient)
          const mtlsPolicies = await MtlsUtil.getMtlsPolicies(k8sClient)
          output.push(["Global MTLS Enabled", 
          globalMtlsStatus.globalMtlsMode ? globalMtlsStatus.globalMtlsMode : globalMtlsStatus.isGlobalMtlsEnabled.toString()])

          const namespacesWithDefaultMtlsPolicies = Object.keys(mtlsPolicies.namespaceDefaultMtlsPolicies)
          if(namespacesWithDefaultMtlsPolicies.length > 0) {
            output.push([">>Namespaces With default mTLS Policies", ""])
            namespacesWithDefaultMtlsPolicies.forEach(ns => output.push([ns, mtlsPolicies.namespaceDefaultMtlsPolicies[ns]]))
          } else {
            output.push([">>No namespaces with default mTLS policies", ""])
          }

          if(mtlsPolicies.servicesWithMtlsPolicies.length > 0) {
            output.push([">>Services With mTLS Policies", ""])
            const servicePoliciesByNamespace = _.groupBy(mtlsPolicies.servicesWithMtlsPolicies, p => p.namespace)
            Object.keys(servicePoliciesByNamespace).forEach(namespace => {
              output.push([">>>Namespace: "+namespace, ""])
              servicePoliciesByNamespace[namespace].map(sp => 
                output.push(["Service: "+sp.serviceName+"."+sp.namespace, sp.policy]))
            })
          } else {
            output.push([">>No services with mTLS policies", ""])
          }

          const outputDestinationRules = (source, target, drules) => {
            output.push([">>>From: [Source "+source+"], To: [Target "+target+"]", ""])
            drules.map(dr => {
              delete dr.data
              output.push([dr.name+" @ "+dr.namespace, dr])
            })
          }
          const mtlsDestinationRules = await MtlsUtil.getMtlsDestinationRules(cluster.k8sClient)
          if(mtlsDestinationRules.globalRules.length === 0 
              && Object.keys(mtlsDestinationRules.allToNSRules).length === 0
              && Object.keys(mtlsDestinationRules.allToServiceRules).length === 0
              && Object.keys(mtlsDestinationRules.nsToAllRules).length === 0
              && Object.keys(mtlsDestinationRules.nsToNSRules).length === 0
              && Object.keys(mtlsDestinationRules.nsToServiceRules).length === 0) {
                output.push([">>No mTLS destination rules", ""])
          }

          if(mtlsDestinationRules.globalRules.length > 0) {
            output.push([">>Global mTLS DestinationRules", ""])
            outputDestinationRules(": All Namespaces", ": All Namespaces", mtlsDestinationRules.globalRules)
          }

          let targetNamespaces = Object.keys(mtlsDestinationRules.allToNSRules)
          if(targetNamespaces.length > 0) {
            output.push([">>mTLS DestinationRules for requests from anywhere to a Namespace ", ""])
            targetNamespaces.forEach(targetNS => {
              outputDestinationRules(": All Namespaces", "Namespace : "+targetNS, 
                mtlsDestinationRules.allToNSRules[targetNS])
            })
          }

          let targetServices = Object.keys(mtlsDestinationRules.allToServiceRules)
          if(targetServices.length > 0) {
            output.push([">>mTLS DestinationRules for requests from anywhere to a Service", ""])
            targetServices.forEach(targetService => {
              outputDestinationRules(": All Namespaces", "Service : "+targetService, 
                mtlsDestinationRules.allToServiceRules[targetService])
            })
          }

          let sourceNamespaces = Object.keys(mtlsDestinationRules.nsToAllRules)
          if(sourceNamespaces.length > 0) {
            output.push([">>mTLS DestinationRules for requests from a Namespace to anywhere", ""])
            sourceNamespaces.forEach(sourceNS => {
              outputDestinationRules("Namespace : "+sourceNS, ": All Namespaces", 
                mtlsDestinationRules.nsToAllRules[sourceNS])
            })
          }

          sourceNamespaces = Object.keys(mtlsDestinationRules.nsToNSRules)
          if(sourceNamespaces.length > 0) {
            output.push([">>mTLS DestinationRules for requests from a Namespace to a Namespace", ""])
            sourceNamespaces.forEach(sourceNS => {
              const nsDestRrules = mtlsDestinationRules.nsToNSRules[sourceNS]
              Object.keys(nsDestRrules).forEach(targetNS => {
                outputDestinationRules("Namespace : "+sourceNS, "Namespace : "+targetNS, nsDestRrules[targetNS])
              })
            })
          }

          sourceNamespaces = Object.keys(mtlsDestinationRules.nsToServiceRules)
          if(sourceNamespaces.length > 0) {
            output.push([">>mTLS DestinationRules for requests from a Namespace to a Service", ""])
            sourceNamespaces.forEach(sourceNS => {
              const serviceDestRrules = mtlsDestinationRules.nsToServiceRules[sourceNS]
              Object.keys(serviceDestRrules).forEach(targetService => {
                outputDestinationRules("Namespace : "+sourceNS, "Service : "+targetService, serviceDestRrules[targetService])
              })
            })
          }
          this.onStreamOutput  && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
