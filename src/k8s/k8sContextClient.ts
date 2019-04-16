import os from 'os'
import _ from 'lodash'
import Yaml from 'js-yaml'
import jp from 'jsonpath'
import fs from 'fs'
import * as k8s from 'kubernetes-client'
import {Cluster, Namespace, PodTemplate} from "./k8sObjectTypes"
import k8sFunctions from './k8sFunctions'

const homedir = os.homedir();
const defaultConfig = k8s.config.fromKubeconfig()

function getUserKubeConfig() {
  return Yaml.safeLoad(fs.readFileSync(homedir + '/.kube/config', 'utf8'));
}

export function getAllClusters() : Cluster[] {
  const kubeConfig = getUserKubeConfig()
  return jp.query(kubeConfig, '$.contexts[*].context.cluster')
                    .filter((item, index, arr) => arr.indexOf(item) === index)
                    .map(name => new Cluster(name))
}

function getClientForCluster(cluster: Cluster) {
  const kubeConfig = getUserKubeConfig()
  const context = jp.query(kubeConfig, "$.contexts[?(@.context.cluster == '" + cluster.name + "')].name")
  kubeConfig["current-context"] = context.length > 0 ? context[0] : ''
  const config = k8s.config.fromKubeconfig(kubeConfig)
  return new k8s.Client1_10({config})
}

export async function getNamespacesForCluster(cluster: Cluster) : Promise<Array<Namespace>> {
  const client = getClientForCluster(cluster)
  const namespaces = await client.api.v1.namespaces.get()
  return namespaces.body.items.map(i => new Namespace(i.metadata.name, cluster))
}
