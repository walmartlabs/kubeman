import _ from 'lodash'
import {Cluster, Namespace, Pod, Item} from "../k8s/k8sObjectTypes";
import * as k8s from '../k8s/k8sClient'


export class NamespaceContext {
  _pods: Pod[] = []
  _items: Item[] = []

  clearPods() {
    this._pods = []
  }

  clearItems() {
    this._items = []
  }

  addPod(pod: Pod) {
    this._pods.push(pod)
  }

  addItem(item: Item) {
    this._items.push(item)
  }

  pods() : Pod[] {
    return this._pods
  }

  items() : Item[] {
    return this._items
  }

  hasPods() : boolean {
    return this._pods.length > 0
  }
}

export class ClusterContext {
  _namespaces: Map<Namespace, NamespaceContext> = new Map()

  clearNamespaces() {
    this._namespaces.clear()
  }

  clearPods() {
    this._namespaces.forEach((nc, namespace) => {
      namespace.pods = []
      nc.clearPods()
    })
  }

  clearItems() {
    this._namespaces.forEach((nc, namespace) => {
      namespace.items = []
      nc.clearItems()
    })
  }

  addNamespace(namespace: Namespace) {
    this._namespaces.set(namespace, new NamespaceContext)
  }

  addNamespaces(namespaces: Namespace[]) {
    namespaces.forEach(this.addNamespace.bind(this))
  }

  addPods(pods: Pod[]) {
    pods.forEach(this.addPod.bind(this))
  }

  addPod(pod: Pod) {
    const namespaceContext = this._namespaces.get(pod.namespace)
    if(!namespaceContext) {
      throw new ReferenceError("Namespace not found: " + pod.namespace)
    }
    pod.namespace.pods.push(pod)
    namespaceContext.addPod(pod)
  }

  addItems(items: Item[]) {
    items.forEach(this.addItem.bind(this))
  }

  addItem(item: Item) {
    const namespaceContext = this._namespaces.get(item.namespace)
    if(!namespaceContext) {
      throw new ReferenceError("Namespace not found: " + item.namespace)
    }
    item.namespace.items.push(item)
    namespaceContext.addItem(item)
  }

  namespace(namespace: Namespace) : NamespaceContext|undefined {
    return this._namespaces.get(namespace)
  }

  namespaces() : Namespace[] {
    return Array.from(this._namespaces.keys())
  }

  pods() : Pod[] {
    return _.flatMap(Array.from(this._namespaces.values()), ns => ns.pods())
  }
}


export default class Context {
  private clusterMap: Map<string, Cluster> = new Map
  private _clusters: Map<Cluster, ClusterContext> = new Map
  hasClusters: boolean = false
  hasNamespaces: boolean = false
  hasPods: boolean = false
  selections: any[] = []

  updateFlags() {
    this.hasClusters = this._clusters.size > 0
    this.hasNamespaces = this.namespaces.length > 0
    this.hasPods = this.pods.length > 0
  }

  async store(clusters: Map<string, Cluster>, namespaces: Map<string, Namespace>, pods: Map<string, Pod>) {
    await this.storeClusters(clusters)
    this.storeNamespaces(namespaces)
    this.storePods(pods)
  }

  async storeClusters(clusters: Map<string, Cluster>) {
    this.clearClusters()
    for(const cluster of clusters.values()) {
      await this.addCluster(cluster)
    }
  }

  storeNamespaces(namespaces: Map<string, Namespace>) {
    this.clearNamespaces()
    namespaces.forEach(this.addNamespace)
  }

  storePods(pods: Map<string, Pod>) {
    this.clearPods()
    pods.forEach(this.addPod)
  }

  clearClusters() {
    this._clusters.clear()
    this.clusterMap.clear()
    this.updateFlags()
  }

  clearNamespaces() {
    this._clusters.forEach((cc, cluster) => {
      cluster.namespaces = []
      cc.clearNamespaces()
    })
    this.updateFlags()
  }

  clearPods() {
    this._clusters.forEach((cc, cluster) => cc.clearPods())
    this.updateFlags()
  }

  addCluster = async (cluster: Cluster) => {
    cluster.k8sClient = await k8s.getClientForCluster(cluster)
    this._clusters.set(cluster, new ClusterContext)
    this.clusterMap.set(cluster.name, cluster)
    this.updateFlags()
  }

  addNamespace = (namespace: Namespace) => {
    const clusterContext = this._clusters.get(namespace.cluster)
    if(!clusterContext) {
      console.log("Cluster %s not found for ns %s", namespace.cluster.name, namespace.name)
      throw new ReferenceError("Cluster not found: " + namespace.cluster)
    }
    namespace.cluster.namespaces.push(namespace)
    clusterContext.addNamespace(namespace)
    this.updateFlags()
  }
  
  addPod = (pod: Pod) => {
    const clusterContext = this._clusters.get(pod.namespace.cluster)
    if(!clusterContext) {
      throw new ReferenceError("Cluster not found: " + pod.namespace.cluster)
    }
    clusterContext.addPod(pod)
    this.updateFlags()
  }

  get clusters() : Cluster[] {
    return Array.from(this.clusterMap.values())
  }

  cluster(clusterName: string) {
    return this.clusterMap.get(clusterName)
  }

  get namespaces() : Namespace[] {
    return _.flatMap(Array.from(this.clusterMap.values()), c => c.namespaces)
  }

  namespace(clusterName: string, nsName: string) {
    const cluster = this.cluster(clusterName)
    const namespaces = cluster && cluster.namespaces.filter(ns => ns.name === nsName)
    return namespaces && namespaces.length > 0 && namespaces[0]
  }

  get pods() : Pod[] {
    return _.flatMap(Array.from(this.clusterMap.values()), 
              c => _.flatMap(c.namespaces, ns => ns.pods))
  }
}