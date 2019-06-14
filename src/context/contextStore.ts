/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {Cluster, Namespace} from "../k8s/k8sObjectTypes";
import * as k8s from '../k8s/k8sClient'


export class NamespaceContext {
}

export class ClusterContext {
  _namespaces: Map<Namespace, NamespaceContext> = new Map()

  clear() {
    this._namespaces.clear()
  }

  addNamespace(namespace: Namespace) {
    this._namespaces.set(namespace, new NamespaceContext)
  }

  addNamespaces(namespaces: Namespace[]) {
    namespaces.forEach(this.addNamespace.bind(this))
  }

  namespace(namespace: Namespace) : NamespaceContext|undefined {
    return this._namespaces.get(namespace)
  }

  namespaces() : Namespace[] {
    return Array.from(this._namespaces.keys())
  }
}


export default class Context {
  static clusterMap: Map<string, [Cluster, ClusterContext]> = new Map
  static hasClusters: boolean = false
  static hasNamespaces: boolean = false
  static hasIstio: boolean = false
  static operationCounter: number = 0
  static selections: any[] = []
  static doubleSelections: boolean = false
  static cachedSelections = {}
  static cacheKey: string = ''
  static errorMessage: string = ''

  static incrementOperation() {
    if(this.operationCounter >= Number.MAX_SAFE_INTEGER) {
      this.operationCounter = 1
    } else {
      ++this.operationCounter
    }
  }

  static updateFlags() {
    this.hasIstio = Array.from(this.clusterMap.values()).map(pair => pair[0].hasIstio).reduce((v1,v2) => v1||v2, false)
    this.hasClusters = this.clusterMap.size > 0
    this.hasNamespaces = this.namespaces.length > 0
  }

  static async store(clusters: Map<string, Cluster>, namespaces: Map<string, Namespace>) {
    await this.storeClusters(clusters)
    this.storeNamespaces(namespaces)
  }

  static async storeClusters(clusters: Map<string, Cluster>) {
    this.clear()
    for(const cluster of clusters.values()) {
      await this.addCluster(cluster)
    }
  }

  static storeNamespaces(namespaces: Map<string, Namespace>) {
    namespaces.forEach(ns => this.addNamespace(ns))
  }

  static clear() {
    this.clusterMap.forEach(clusterRec => clusterRec[0].namespaces = [])
    this.clusterMap.clear()
    this.updateFlags()
  }

  static async addCluster(cluster: Cluster) {
    cluster.clearNamespaces()
    cluster.k8sClient = await k8s.getClientForCluster(cluster)
    this.hasIstio = this.hasIstio || cluster.hasIstio
    this.clusterMap.set(cluster.name, [cluster, new ClusterContext])
    this.updateFlags()
  }

  static addNamespace(namespace: Namespace) {
    const clusterRec = this.clusterMap.get(namespace.cluster.name)
    const clusterContext = clusterRec && clusterRec[1]
    if(!clusterContext) {
      console.log("Cluster %s not found for ns %s", namespace.cluster.name, namespace.name)
      throw new ReferenceError("Cluster not found: " + namespace.cluster)
    }
    namespace.cluster.namespaces.push(namespace)
    clusterContext.addNamespace(namespace)
    this.updateFlags()
  }

  static get clusters() : Cluster[] {
    return Array.from(this.clusterMap.values()).map(rec => rec[0])
  }

  static cluster(clusterName: string) {
    const clusterRec = this.clusterMap.get(clusterName)
    return clusterRec && clusterRec[0]
  }

  static get namespaces() : Namespace[] {
    return _.flatMap(Array.from(this.clusterMap.values()), rec => rec[0].namespaces)
  }

  static namespace(clusterName: string, nsName: string) {
    const cluster = this.cluster(clusterName)
    const namespaces = cluster && cluster.namespaces.filter(ns => ns.name === nsName)
    return namespaces && namespaces.length > 0 && namespaces[0]
  }
}