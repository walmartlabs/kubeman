import os from 'os'
import _ from 'lodash'
import Yaml from 'js-yaml'
import jp from 'jsonpath'
import fs from 'fs'
import * as k8s from 'kubernetes-client'
import {Cluster, Namespace, Pod, Item} from "./k8sObjectTypes";

const homedir = os.homedir();
const defaultConfig = k8s.config.fromKubeconfig()

export interface K8sClient extends k8s.ApiV1 {
  apps: k8s.ApisAppsV1
  extensions: k8s.ApisApiextensions_k8s_ioV1beta1
  istio?: any,
  crds: any,
}

export type K8sAdminClient = k8s.Api

function getUserKubeConfig() {
  return Yaml.safeLoad(fs.readFileSync(homedir + '/.kube/config', 'utf8'));
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
  const client = new k8s.Client1_10({config})
  const k8sV1Client = client.api.v1
  const k8sAppsClient = client.api.apps.v1
  const extensions = client.apis["apiextensions.k8s.io"].v1beta1

  const k8sClient: K8sClient = {
    ...k8sV1Client,
    apps: k8sAppsClient,
    extensions,
    crds: {},
  }
  try {
    const result = await extensions.customresourcedefinitions.get()
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
  return k8sClient
}
