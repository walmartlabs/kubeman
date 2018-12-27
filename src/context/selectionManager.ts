import _ from 'lodash'
import deburr from 'lodash/deburr';

import {Cluster, Namespace, Pod, KubeComponent, KubeComponentType} from "../k8s/k8sObjectTypes";
import * as k8s from '../k8s/k8sContextClient'

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

  static loadPodsForNamespaces(allNamespaces: boolean) {
    this.namespacePods = {}
    const namespacesToLoad : Namespace[] = allNamespaces ? 
            _.flatten(_.values(this.clusterNamespaces))
            : 
            Array.from(this.selectedNamespaces.values())
    namespacesToLoad.forEach(namespace => {
      const pods = this.getPodsForNamespace(namespace)
      this.namespacePods[namespace.text()] = pods
      pods.forEach(pod => this.allPods.push(pod))
    })
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
          Promise.all(
            namespaces.map(ns => this.loadNamespaceData(ns, namespaceMap))
          )
          .then(result => {
            this.clusterData.set(cluster.text(), [cluster, namespaceMap])
            this.loadingCounter--
            resolve(true)
          })
          .catch(err => {
            this.loadingCounter--
            console.log("Failed to load pods for some namespaces: " + err)
            reject(false)
          })
        })
        .catch(error => {
          this.clustersInError.push(cluster.text())
          this.loadingCounter--
          console.log("Error while loading namespaces for cluster %s: %s", cluster.text(), error)
          reject(false)
        })
    })
  }

  private static loadNamespaceData(namespace: Namespace,  namespaceMap : NamespaceData) : Promise<boolean> {
    return new Promise((resolve, reject) => {
      k8s.getPodsForNamespace(namespace)
      .then(pods => {
        const podMap : PodData = new Map
        pods.forEach(pod => podMap.set(pod.text(), pod))
        namespaceMap.set(namespace.text(), [namespace, podMap])
        resolve(true)
      })
      .catch(error => {
        this.namespacesInError.push(namespace.text())
        console.log("Error while loading pods for namespace %s: %s", namespace.name, error)
        reject(false)
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

  static getPodsForNamespace(namespace: Namespace) : Pod[] {
    const clusterNamespaceData = this.clusterData.get(namespace.cluster.text())
    const namespaceData = clusterNamespaceData && clusterNamespaceData[1].get(namespace.text())
    return namespaceData ? Array.from(namespaceData[1].values())
                      .sort((p1,p2) => p1.name.localeCompare(p2.name)) : []

  }

  static filter(filterText: string, type: KubeComponentType) : KubeComponent[] {
    filterText = filterText ? deburr(filterText.trim()).toLowerCase() : ''
    const pieces = filterText.split("or")
    const results: Map<string, KubeComponent> = new Map
    pieces.forEach(piece => {
      const filters = piece.split(" ")
      let items: KubeComponent[] = type === KubeComponentType.Namespace ? this.allNamespaces : this.allPods
      filters.forEach(filter => {
        items = items.filter(item => item.name.includes(filter))
      })
      items.forEach(item => results.set(item.text(), item))
    })
    return Array.from(results.values())
  }

  static getMatchingNamespaces(filterText: string) : Namespace[] {
    return this.filter(filterText, KubeComponentType.Namespace) as Namespace[]
  }

  static getMatchingPods(filterText: string) : Pod[] {
    return this.filter(filterText, KubeComponentType.Pod) as Pod[]
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