/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'

import {Cluster, Namespace, KubeComponent, KubeComponentType} from "../k8s/k8sObjectTypes";
import * as k8s from '../k8s/k8sContextClient'
import {filter} from '../util/filterUtil'

export type NamespaceData = Map<string, Namespace>
export type ClusterNamespaceData = [Cluster, NamespaceData]
export type ClusterData = Map<string, ClusterNamespaceData>

export type Clusters = {[group: string]: Cluster[]}
export type ClusterNamespaces = {[cluster: string]: Namespace[]}

export type SelectedClusters = Map<string, Cluster>
export type SelectedNamespaces = Map<string, Namespace>

export default class SelectionManager {
  static clusters: Clusters = {}
  static clusterNamespaces: ClusterNamespaces = {}
  static allNamespaces: Namespace[] = []

  static clusterData: ClusterData = new Map
  static clustersInError: string[] = []
  static namespacesInError: string[] = []

  static selectedClusters: SelectedClusters = new Map
  static selectedNamespaces: SelectedNamespaces = new Map

  private static loadingCounter: number = 0

  static loadClusters(clusters: Cluster[]) {
    this.clusters = {'': []}
    clusters.forEach(c => this.clusters[''].push(c))
    this.clusterNamespaces = {}
    this.allNamespaces = []
  }

  static loadNamespacesForSelectedClusters() {
    this.clusterNamespaces = {}
    this.selectedClusters.forEach(cluster => {
      const namespaces = this.getNamespacesForCluster(cluster)
      this.clusterNamespaces[cluster.text()] = namespaces
      namespaces.forEach(ns => this.allNamespaces.push(ns))
    })
  }

  static setSelections(selectedClusters: SelectedClusters, selectedNamespaces: SelectedNamespaces) {
    this.clustersInError = []
    this.namespacesInError = []
    this.selectedClusters = new Map(selectedClusters)
    this.selectedNamespaces = new Map(selectedNamespaces)
  }

  static loadSelectedClustersData() {
    const clustersToLoad : Cluster[] = Array.from(this.selectedClusters.values())
    if(clustersToLoad.length > 0) {
      return Promise.all(clustersToLoad.map(cluster => this.loadClusterData(cluster)))
        .then(this.removeInvalidItems.bind(this))
        .catch(error => {
            console.log("[Loading %s] Loading cluster data failed for selected clusters: %s", 
                this.loadingCounter, clustersToLoad)
        })
    } else {
      return Promise.resolve()
    }
  }

  static loadClusterData(cluster: Cluster) {
    this.clustersInError = this.clustersInError.filter(c => c !== cluster.text())
    this.namespacesInError = []
    this.loadingCounter++
    return new Promise((resolve, reject) => {
      const namespaceMap : NamespaceData = new Map
      k8s.getNamespacesForCluster(cluster)
        .then(namespaces => {
          namespaces.forEach(namespace => namespaceMap.set(namespace.text(), namespace))
          this.clusterData.set(cluster.name, [cluster, namespaceMap])
          this.loadingCounter--
          resolve(true)
        })
        .catch(error => {
          this.clustersInError.push(cluster.text())
          this.loadingCounter--
          console.log("Error while loading namespaces for cluster %s: %s", cluster.text(), error)
          resolve(false)
        })
    })
  }

  private static removeInvalidItems() {
    this.selectedClusters.forEach(c => {
      if(!this.clusterData.has(c.text())) {
        this.selectedClusters.delete(c.text())
      }
    })
    this.selectedNamespaces.forEach(ns => {
      if(!this.selectedClusters.get(ns.cluster.text())) {
        this.selectedNamespaces.delete(ns.text())
      }
      const clusterRec = this.clusterData.get(ns.cluster.text())
      if(!clusterRec || !clusterRec[1].has(ns.text())) {
        this.selectedNamespaces.delete(ns.text())
      } else {
        const namespace = clusterRec[1].get(ns.text())
        namespace && this.selectedNamespaces.set(ns.text(), namespace)
      }
    })
  }

  static deselectCluster(cluster: Cluster) {
    this.selectedNamespaces.forEach(namespace => {
      if(namespace.cluster.text() === cluster.text()) {
        this.deselectNamespace(namespace)
      }
    })
    this.selectedClusters.delete(cluster.text())
  }

  static deselectAllClusters() {
    this.selectedClusters.forEach(cluster => this.deselectCluster(cluster))
  }

  static deselectNamespace(namespace: Namespace) {
    this.selectedNamespaces.delete(namespace.text())
  }

  static deselectAllNamespaces() {
    this.selectedNamespaces.forEach(ns => this.deselectNamespace(ns))
  }

  static setFilteredSelections(namespcaes: Namespace[]) {
    this.selectedNamespaces.clear()
    namespcaes.forEach(namespace => this.selectedNamespaces.set(namespace.text(), namespace))
  }

  static getNamespacesForCluster(cluster: Cluster) : Namespace[] {
    const clusterNamespaceData = this.clusterData.get(cluster.text())
    return clusterNamespaceData ? 
            Array.from(clusterNamespaceData[1].values())
              .sort((n1,n2) => n1.name.localeCompare(n2.name)) : []
  }

  static filter(filterText: string, type: KubeComponentType) : KubeComponent[] {
    return filter(filterText, this.allNamespaces, 'name') as KubeComponent[]
  }

  static async getMatchingNamespaces(filterText: string) {
    return this.filter(filterText, KubeComponentType.Namespace) as Namespace[]
  }

  static get isLoading() {
    return this.loadingCounter > 0
  }

  static get isAnyClusterInError() {
    return this.clustersInError.length > 0
  }

  static get isAnySelectedClusterInError() {
    return this.clustersInError.filter(c => this.selectedClusters.has(c)).length > 0
  }

  static isClusterInError(cluster: Cluster) {
    return this.clustersInError.includes(cluster.text())
  }

  static get isAnyNamespaceInError() {
    return this.namespacesInError.length > 0
  }

  static isNamespaceInError(namespace: Namespace) {
    return this.namespacesInError.includes(namespace.text())
  }
}