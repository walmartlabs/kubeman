import os from 'os'
import _ from 'lodash'
import Yaml from 'js-yaml'
import jp from 'jsonpath'
import fs from 'fs'
import * as k8s from 'kubernetes-client'
import {Cluster, Namespace, Pod, Item} from "./contextObjectTypes";

const homedir = os.homedir();
const defaultConfig = k8s.config.fromKubeconfig()

export interface K8sClient extends k8s.ApiV1 {
  apps: k8s.ApisAppsV1
}

export type K8sAdminClient = k8s.Api

function getUserKubeConfig() {
  return Yaml.safeLoad(fs.readFileSync(homedir + '/.kube/config', 'utf8'));
}

export function getClientForCluster(cluster: Cluster) : K8sClient {
  const kubeConfig = getUserKubeConfig()
  const context = jp.query(kubeConfig, "$.contexts[?(@.context.cluster == '" + cluster.name + "')].name")
  kubeConfig["current-context"] = context.length > 0 ? context[0] : ''
  const config = k8s.config.fromKubeconfig(kubeConfig)
  const k8sV1Client = new k8s.Client1_10({config}).api.v1
  const k8sAppsClient = new k8s.Client1_10({config}).api.apps.v1

  const k8sClient: K8sClient = {
    ...k8sV1Client,
    apps: k8sAppsClient,
  }

  return k8sClient
}

export async function getPodsForNamespace(namespace: Namespace) : Promise<Array<any>> {
  const client = getClientForCluster(namespace.cluster)
  const pods = await client.namespace(namespace.name).pods.get()
  return pods.body.items
}
