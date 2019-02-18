import _ from 'lodash'

import {Cluster, Namespace, Pod, KubeComponent, KubeComponentType} from "../k8s/k8sObjectTypes";
import * as k8s from '../k8s/k8sContextClient'
import {filter} from '../util/filterUtil'

export type PodData = Map<string, Pod>
export type NamespacePodData = [Namespace, PodData]
export type NamespaceData = Map<string, NamespacePodData>
export type ClusterNamespaceData = [Cluster, NamespaceData]
export type ClusterData = Map<string, ClusterNamespaceData>

export type Clusters = {[group: string]: Cluster[]}
export type ClusterNamespaces = {[cluster: string]: Namespace[]}
export type NamespacePods = {[namespace: string]: Pod[]}

export type SelectedClusters = Map<string, Cluster>
export type SelectedNamespaces = Map<string, Namespace>
export type SelectedPods = Map<string, Pod>

export default class SelectionManager {
  static clusters: Clusters = {}
  static clusterNamespaces: ClusterNamespaces = {}
  static allNamespaces: Namespace[] = []
  static namespacePods: NamespacePods = {}
  static allPods: Pod[] = []

  static clusterData: ClusterData = new Map
  static clustersInError: string[] = []
  static namespacesInError: string[] = []

  static selectedClusters: SelectedClusters = new Map
  static selectedNamespaces: SelectedNamespaces = new Map
  static selectedPods: SelectedPods = new Map

  private static loadingCounter: number = 0

  static loadClusters(clusters: Cluster[]) {
    this.clusters = {'': []}
    clusters.forEach(c => this.clusters[''].push(c))
    this.clusterNamespaces = {}
    this.allNamespaces = []
    this.namespacePods = {}
    this.allPods = []
  }

  static loadNamespacesForSelectedClusters() {
    this.clusterNamespaces = {}
    this.selectedClusters.forEach(cluster => {
      const namespaces = this.getNamespacesForCluster(cluster)
      this.clusterNamespaces[cluster.text()] = namespaces
      namespaces.forEach(ns => this.allNamespaces.push(ns))
    })
  }

  static async loadPodsForSelectedNamespaces() {
    await this.loadPodsForNamespaces(Array.from(this.selectedNamespaces.values()))
  }

  static async loadPodsForNamespaces(namespaces: Namespace[]) {
    this.namespacePods = {}
    this.allPods = []
    for(const namespace of namespaces) {
      await this.loadNamespacePods(namespace)
    }
  }

  private static async loadNamespacePods(namespace: Namespace) {
    const clusterNamespaceMap = this.clusterData.get(namespace.cluster.name)
    const namespaceMap = clusterNamespaceMap ? clusterNamespaceMap[1] : new Map
    await k8s.getPodsForNamespace(namespace)
      .then(pods => {
        const podMap : PodData = new Map
        pods.forEach(pod => {
          podMap.set(pod.text(), pod)
          this.allPods.push(pod)
        })
        this.namespacePods[namespace.text()] = pods
        namespaceMap.set(namespace.text(), [namespace, podMap])
        this.clusterData.set(namespace.cluster.name, [namespace.cluster, namespaceMap])
      })
      .catch(error => {
        this.namespacesInError.push(namespace.text())
        console.log("Error while loading pods for namespace %s: %s", namespace.name, error)
      })
  }

  static getPodsForNamespace(namespace: Namespace) : Pod[] {
    const clusterNamespaceData = this.clusterData.get(namespace.cluster.text())
    const namespaceData = clusterNamespaceData && clusterNamespaceData[1].get(namespace.text())
    return namespaceData ? Array.from(namespaceData[1].values())
                      .sort((p1,p2) => p1.name.localeCompare(p2.name)) : []

  }

  static setSelections(selectedClusters: SelectedClusters, selectedNamespaces: SelectedNamespaces, selectedPods: Map<string, Pod>) {
    this.selectedClusters = new Map(selectedClusters)
    this.selectedNamespaces = new Map(selectedNamespaces)
    this.selectedPods = new Map(selectedPods)
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
    this.clustersInError = []
    this.namespacesInError = []
    this.loadingCounter++
    return new Promise((resolve, reject) => {
      const namespaceMap : NamespaceData = new Map
      k8s.getNamespacesForCluster(cluster)
        .then(namespaces => {
          namespaces.forEach(namespace => namespaceMap.set(namespace.text(), [namespace, new Map]))
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
        const nsRec = clusterRec[1].get(ns.text())
        nsRec && this.selectedNamespaces.set(ns.text(), nsRec[0])
      }
    })
    this.selectedPods.forEach(pod => {
      if(!this.selectedNamespaces.get(pod.namespace.text())) {
        this.selectedPods.delete(pod.text())
      }
      const clusterRec = this.clusterData.get(pod.namespace.cluster.text())
      const nsRec = clusterRec && clusterRec[1].get(pod.namespace.text())
      if(!clusterRec || !nsRec) {
        this.selectedPods.delete(pod.text())
      } else {
        const newPod = nsRec[1].get(pod.text())
        if(!newPod) {
          this.selectedPods.delete(pod.text())
        } else {
          newPod && this.selectedPods.set(pod.text(), newPod)
        }
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

  static deselectNamespace(namespace: Namespace) {
    this.selectedPods.forEach(pod => {
      if(pod.namespace.text() === namespace.text()) {
        this.selectedPods.delete(pod.text())
      }
    })
    this.selectedNamespaces.delete(namespace.text())
  }

  static setFilteredSelections(namespcaes: Namespace[], pods: Pod[]) {
    this.selectedNamespaces.clear()
    this.selectedPods.clear()
    pods.forEach(pod => {
      this.selectedNamespaces.set(pod.namespace.text(), pod.namespace)
      this.selectedPods.set(pod.text(), pod)
    })
    namespcaes.forEach(namespace => this.selectedNamespaces.set(namespace.text(), namespace))
  }

  static getNamespacesForCluster(cluster: Cluster) : Namespace[] {
    const clusterNamespaceData = this.clusterData.get(cluster.text())
    return clusterNamespaceData ? 
            Array.from(clusterNamespaceData[1].values())
              .map(rec => rec[0])
              .sort((n1,n2) => n1.name.localeCompare(n2.name)) : []
  }

  static filter(filterText: string, type: KubeComponentType) : KubeComponent[] {
    const items: KubeComponent[] = type === KubeComponentType.Namespace ? this.allNamespaces : this.allPods
    return filter(filterText, items, 'name') as KubeComponent[]
  }

  static async getMatchingNamespacesAndPods(filterText: string, loadPods: boolean) {
    const namespaces = this.filter(filterText, KubeComponentType.Namespace) as Namespace[]
    let pods: Pod[] = []
    if(loadPods) {
      await this.loadPodsForNamespaces(namespaces)
      pods = this.filter(filterText, KubeComponentType.Pod) as Pod[]
      pods.forEach(pod => {
        if(!namespaces.includes(pod.namespace)) {
          namespaces.push(pod.namespace)
        }
      })
    }
    return {namespaces, pods}
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