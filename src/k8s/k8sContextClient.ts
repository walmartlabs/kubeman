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
import {Cluster, Namespace, PodTemplate} from "./k8sObjectTypes"

const homedir = os.homedir();

function getUserKubeConfig() {
  try {
    return Yaml.safeLoad(fs.readFileSync(homedir + '/.kube/config', 'utf8'))
  } catch(error) {
    console.log(error)
  }
  return undefined
}

export function getAllClusters() : Cluster[] {
  const kubeConfig = getUserKubeConfig()
  if(kubeConfig) {
    return kubeConfig.contexts.map(context => {
      return {cluster: context.context.cluster, context: context.name}
    })
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .sort()
    .map(item => new Cluster(item.cluster, item.context))
  } else {
    return []
  }
}

function getClientForCluster(cluster: Cluster) {
  const kubeConfig = getUserKubeConfig()
  const context = jp.query(kubeConfig, "$.contexts[?(@.name == '" + cluster.context + "')].name")
  kubeConfig["current-context"] = context.length > 0 ? context[0] : ''
  const config = k8s.config.fromKubeconfig(kubeConfig)
  return new k8s.Client1_13({config})
}

export async function getNamespacesForCluster(cluster: Cluster) : Promise<Array<Namespace>> {
  const client = getClientForCluster(cluster)
  const namespaces = await client.api.v1.namespaces.get()
  return namespaces.body.items.map(i => new Namespace(i.metadata.name, cluster))
}
