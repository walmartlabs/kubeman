import os from 'os'
import _ from 'lodash'
import Yaml from 'js-yaml'
import jp from 'jsonpath'
import fs from 'fs'
import * as k8s from 'kubernetes-client'
import {Cluster, Namespace, Pod, Item} from "./contextObjectTypes";

const homedir = os.homedir();
const defaultConfig = k8s.config.fromKubeconfig()

export type K8sClient = k8s.ApiV1
export type K8sAdminClient = k8s.Api

function getUserKubeConfig() {
  return Yaml.safeLoad(fs.readFileSync(homedir + '/.kube/config', 'utf8'));
}

export function getClientForCluster(cluster: Cluster) : K8sClient {
  const kubeConfig = getUserKubeConfig()
  const context = jp.query(kubeConfig, "$.contexts[?(@.context.cluster == '" + cluster.name + "')].name")
  kubeConfig["current-context"] = context.length > 0 ? context[0] : ''
  const config = k8s.config.fromKubeconfig(kubeConfig)
  return new k8s.Client1_10({config}).api.v1
}

export async function getPodsForNamespace(namespace: Namespace) : Promise<Array<any>> {
  const client = getClientForCluster(namespace.cluster)
  const pods = await client.namespace(namespace.name).pods.get()
  return pods.body.items
}
