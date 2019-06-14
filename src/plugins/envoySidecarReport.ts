/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions';
import IstioFunctions from '../k8s/istioFunctions';
import yaml from 'yaml'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Analysis Recipes",
  actions: [
    {
      name: "Sidecar Injection Report",
      order: 4,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput && this.onOutput([["", "Sidecar Injection Report"]], ActionOutputStyle.Table)

        this.showOutputLoading && this.showOutputLoading(true)
        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name, ""]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["", "Istio not installed"]])
            continue
          }

          let output: ActionOutput = []
          const sidecarInjectorWebhook = await IstioFunctions.getSidecarInjectorWebhook(cluster.k8sClient)
          output.push([">>Sidecar Injection Webhook Details", ""])
          if(sidecarInjectorWebhook) {
            output.push(["Namespace Selector", sidecarInjectorWebhook.namespaceSelector])
            output.push(["Failure Policy", sidecarInjectorWebhook.failurePolicy])
            output.push(["Timeout Seconds", sidecarInjectorWebhook.timeoutSeconds])
          } else {
            output.push(["Sidecar Injection Webhook not configured", ""])
          }

          output.push([">>Namespace", "Sidecar Injection Status"])
      
          const namespaces = await K8sFunctions.getClusterNamespaces(cluster.k8sClient)
          namespaces.length === 0 && output.push(["", "No namespaces found"])
          namespaces.forEach(namespace => {
            const isSidecarInjectionEnabled = namespace.labels && Object.keys(namespace.labels)
                                              .filter(l => l.includes("istio-injection"))
                                              .filter(l => namespace.labels[l].includes("enabled")).length > 0
            output.push([namespace.name, isSidecarInjectionEnabled ? "Enabled" : "Disabled"])
          })
          this.onStreamOutput && this.onStreamOutput(output)

          output = []
          for(const namespace of namespaces) {
            const deployments = (await K8sFunctions.getNamespaceDeployments(cluster.name, namespace.name, cluster.k8sClient))
                                  .filter(d => d.template.annotations && 
                                    d.template.annotations.filter(a => a.includes("sidecar.istio.io/inject"))
                                    .length > 0
                                  )
            if(deployments.length > 0) {
              output.push([">>Sidecar Injection overrides for Namespace: " + namespace.name, ""])
              deployments.forEach(d => {
                const sidecarInjectionAnnotation = d.template.annotations && 
                                d.template.annotations.filter(a => a.includes("sidecar.istio.io/inject"))
                if(sidecarInjectionAnnotation && sidecarInjectionAnnotation.length > 0) {
                  output.push([d.name, sidecarInjectionAnnotation[0]])
                }
              })
            }
          }

          output.push([">>Sidecar Injector ConfigMap", ""])
          const sidecarInjectorConfigMap = await K8sFunctions.getNamespaceConfigMap("istio-sidecar-injector", "istio-system", cluster.k8sClient)
          const configData = sidecarInjectorConfigMap && yaml.parse(sidecarInjectorConfigMap.data.config)
          configData && output.push(["Policy", configData.policy])
          configData && output.push(["Template", "<pre>"+configData.template+"</pre>"])

          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    }
  ]
}

export default plugin
