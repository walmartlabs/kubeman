/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import os from 'os'
import _ from 'lodash'
import Yaml from 'js-yaml'
import jp from 'jsonpath'
import fs from 'fs'
import * as k8s from 'kubernetes-client'
import {config as KubeConfig} from 'kubernetes-client/backends/request'
import {Cluster} from "./k8sObjectTypes"
import KubectlClient from './kubectlClient'

const homedir = os.homedir()

export interface K8sClient extends k8s.ApiV1 {
  cluster: Cluster
  apps: k8s.ApisAppsV1
  autoscaling: k8s.ApisAutoscalingV1
  rbac: k8s.ApisRbac_authorization_k8s_ioV1
  policy: k8s.ApisPolicyV1beta1
  networking: k8s.ApisNetworking_k8s_ioV1
  extensions: k8s.ApisExtensionsV1beta1
  batch: k8s.ApisBatchV1
  settings: k8s.ApisSettings_k8s_ioV1alpha1
  storage: k8s.ApisStorage_k8s_ioV1
  scheduling: k8s.ApisScheduling_k8s_ioV1alpha1
  apiregistration: k8s.ApisApiregistration_k8s_ioV1
  apiextensions: k8s.ApisApiextensions_k8s_ioV1beta1
  admissionregistration: k8s.ApisAdmissionregistration_k8s_ioV1beta1
  certificates: k8s.ApisCertificates_k8s_ioV1beta1
  authorization: k8s.ApisAuthorization_k8s_ioV1
  authentication: k8s.ApisAuthentication_k8s_ioV1
  crds: any,
  istio?: any,
  canPodExec?: boolean,
}

export type K8sAdminClient = k8s.Api

function getUserKubeConfig() {
  return Yaml.safeLoad(fs.readFileSync(homedir + '/.kube/config', 'utf8'))
}

export async function getClientForCluster(cluster: Cluster) {
  const kubeConfig = getUserKubeConfig()
  const context = jp.query(kubeConfig, "$.contexts[?(@.context.cluster == '" + cluster.name + "')].name")
  if(context.length > 0) {
    kubeConfig["current-context"] = context[0]
  } else {
    throw new Error("Cannot identify cluster " + cluster.name + " from config.")
  }
  const config = k8s.config.fromKubeconfig(kubeConfig)
  const client = new k8s.Client1_13({config})

  const k8sClient: K8sClient = {
    cluster,
    ...client.api.v1,
    autoscaling: client.apis.autoscaling.v1,
    apps: client.apis.apps.v1,
    rbac: client.apis["rbac.authorization.k8s.io"].v1beta1,
    policy: client.apis.policy.v1beta1,
    networking: client.apis["networking.k8s.io"].v1,
    extensions: client.apis.extensions.v1beta1,
    batch: client.apis.batch.v1,
    settings: client.apis["settings.k8s.io"].v1alpha1,
    storage: client.apis["storage.k8s.io"].v1,
    scheduling: client.apis["scheduling.k8s.io"].v1alpha1,
    apiregistration: client.apis["apiregistration.k8s.io"].v1,
    apiextensions: client.apis["apiextensions.k8s.io"].v1beta1,
    admissionregistration: client.apis["admissionregistration.k8s.io"].v1beta1,
    certificates: client.apis["certificates.k8s.io"].v1beta1,
    authorization: client.apis["authorization.k8s.io"].v1,
    authentication: client.apis["authentication.k8s.io"].v1,
    crds: {},
  }
  try {
    const result = await k8sClient.apiextensions.customresourcedefinitions.get()
    const crds = result.body.items ? result.body.items : []
    const istioCRDMap = {}
    const istioCRDS = crds.filter(item => item.spec.group.includes("istio.io"))
                            .map(crd => {
                              istioCRDMap[crd.spec.group] = crd
                              return crd.metadata.name
                            })
    crds.forEach(crd => {
      client.addCustomResourceDefinition(crd)
      if(client.apis[crd.spec.group]) {
        const crdName = crd.metadata.name.split(".")[0]
        k8sClient.crds[crd.metadata.name]=client.apis[crd.spec.group][crd.spec.version][crdName]
      }
    })
    if(client.apis["config.istio.io"]) {
      k8sClient.istio = client.apis["config.istio.io"][istioCRDMap["config.istio.io"].spec.version]
      k8sClient.istio.crds = istioCRDS
    }
    if(client.apis["networking.istio.io"]) {
      const networkingAPI = client.apis["networking.istio.io"][istioCRDMap["networking.istio.io"].spec.version]
      k8sClient.istio.namespaces = networkingAPI.namespaces
      k8sClient.istio.destinationrules = networkingAPI.destinationrules
      k8sClient.istio.envoyfilters = networkingAPI.envoyfilters
      k8sClient.istio.gateways = networkingAPI.gateways
      k8sClient.istio.serviceentries = networkingAPI.serviceentries
      k8sClient.istio.virtualservices = networkingAPI.virtualservices
      k8sClient.istio.sidecars = networkingAPI.sidecars
    }
    if(client.apis["authentication.istio.io"]) {
      const authAPI = client.apis["authentication.istio.io"][istioCRDMap["authentication.istio.io"].spec.version]
      k8sClient.istio.policies = authAPI.policies
      k8sClient.istio.meshpolicies = authAPI.meshpolicies
    }
    if(client.apis["rbac.istio.io"]) {
      const rbacAPI = client.apis["rbac.istio.io"][istioCRDMap["rbac.istio.io"].spec.version]
      k8sClient.istio.clusterrbacconfigs = rbacAPI.clusterrbacconfigs
      k8sClient.istio.rbacconfigs = rbacAPI.rbacconfigs
      k8sClient.istio.servicerolebindings = rbacAPI.servicerolebindings
      k8sClient.istio.serviceroles = rbacAPI.serviceroles
    }
    cluster.hasIstio = istioCRDS.length > 0
  } catch(error) {
    cluster.hasIstio = false
    console.log("Failed to load Istio CRDs for cluster " + cluster.name)
    console.log(error)
  }
  console.clear()
  await KubectlClient.getServices(cluster)
    .then(results => {
      cluster.hasKubectl = true
      console.log("kubectl is accessible")
    })
    .catch(error => {
      cluster.hasKubectl = false
      console.log("kubectl is not accessible")
    })
  let podExecResult
  try {
    const pods = await k8sClient.namespace("kube-system").pods.get({qs: {labelSelector: "component=kube-apiserver"}})
    if(pods && pods.body && pods.body.items && pods.body.items.length > 0) {
      const pod = pods.body.items[0].metadata.name
      try {
        podExecResult = await k8sClient.namespaces("kube-system").pods(pod).exec.post({
          qs: {
            container: "kube-apiserver",
            command: ["ls"],
            stdout: true,
            stderr: true,
          }
        })
        podExecResult = podExecResult.body
      } catch(error) {
        if(cluster.hasKubectl) {
          podExecResult = await KubectlClient.executePodCommand(cluster, "kube-system", pod, "kube-apiserver", "ls")
        }
      }
    }
  } catch(error) {
    console.log("Cannot execute commands on pods")
    console.log(error)
  }
  if(podExecResult && podExecResult.length > 0) {
    cluster.canPodExec = true
    k8sClient.canPodExec = true
  } else {
    cluster.canPodExec = false
    k8sClient.canPodExec = false
  }
  return k8sClient
}
