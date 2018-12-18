import os from 'os'
import _ from 'lodash'
import Yaml from 'js-yaml'
import jp from 'jsonpath'
import fs from 'fs'
import * as k8s from 'kubernetes-client'
import {Cluster, Namespace, Pod, Item} from "./k8sObjectTypes";

const homedir = os.homedir();
const defaultConfig = k8s.config.fromKubeconfig()

function getUserKubeConfig() {
  return Yaml.safeLoad(fs.readFileSync(homedir + '/.kube/config', 'utf8'));
}

export function getAllClusters() : Cluster[] {
  const kubeConfig = getUserKubeConfig()
  return jp.query(kubeConfig, '$.clusters[*].name').map(name => new Cluster(name))
  /*
  const kubeConfig = {
    apiVersion: 'v1',
    clusters: [{
      "name": "vsh01.s05518.us/labs/cluster1",
      "cluster": {
        "certificate-authority": "/Users/vn0b25d/.sledge/vsh01.s05518.us/labs/cluster1/ca.pem",
        "server": "https://lb-master.cluster1.cloud.s05518.us.wal-mart.com"
      }
    }],
    contexts: [{
      context: {
        cluster: "vsh01.s05518.us/labs/cluster1",
        user: "vsh01.s05518.us/labs/cluster1/admin"
      },
      name: "vsh01.s05518.us/labs/cluster1/admin"
    }],
    "current-context": "vsh01.s05518.us/labs/cluster1/admin",
    kind: "Config",
    users: [{
      name: "vsh01.s05518.us/labs/cluster1/admin",
      user: {
        "client-certificate": "/Users/vn0b25d/.sledge/vsh01.s05518.us/labs/cluster1/admin.pem",
        "client-key": "/Users/vn0b25d/.sledge/vsh01.s05518.us/labs/cluster1/admin-key.pem"
      }
    }]
  }
  const config = k8s.config.fromKubeconfig(kubeConfig)
  const client = new k8s.Client1_10({config})
  */
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

export async function getPodsForNamespace(namespace: Namespace) : Promise<Array<Pod>> {
  const client = getClientForCluster(namespace.cluster)
  const pods = await client.api.v1.namespace(namespace.name).pods.get()
  return pods.body.items.map(i => new Pod(i.metadata.name, namespace))
}
