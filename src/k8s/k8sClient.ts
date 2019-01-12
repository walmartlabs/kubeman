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
  istio?: any
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
  }

  await Promise.all([
    extensions.crd("gateways.networking.istio.io").get(),
    extensions.crd("virtualservices.networking.istio.io").get(),
    extensions.crd("destinationrules.networking.istio.io").get(),
    extensions.crd("serviceentries.networking.istio.io").get(),
    extensions.crd("envoyfilters.networking.istio.io").get(),
    extensions.crd("policies.authentication.istio.io").get(),
    extensions.crd("meshpolicies.authentication.istio.io").get(),
    extensions.crd("rules.config.istio.io").get(),
  ])
  .then((results: any[]) => {
    results.map(result => result.body).forEach(crd => client.addCustomResourceDefinition(crd))
    k8sClient.istio = client.apis["networking.istio.io"].v1alpha3
    const authAPI = client.apis["authentication.istio.io"].v1alpha1
    k8sClient.istio.policies = authAPI.policies
    k8sClient.istio.meshpolicies = authAPI.meshpolicies
    const configAPI = client.apis["config.istio.io"].v1alpha2
    k8sClient.istio.rules = configAPI.rules
    cluster.hasIstio = true
  })
  .catch(error => {
    cluster.hasIstio = false
    console.log("Failed to load Istio CRDs for cluster " + cluster.name)
})

  return k8sClient
}
