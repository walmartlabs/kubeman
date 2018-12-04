import _ from 'lodash'
import {Cluster, Namespace, Pod, Item} from "../k8s/contextObjectTypes";


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
    Array.from(this._namespaces.values()).forEach(nc => nc.clearPods())
  }

  clearItems() {
    Array.from(this._namespaces.values()).forEach(nc => nc.clearItems())
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
  private _clusters: Map<Cluster, ClusterContext> = new Map()

  storeClusters(clusters: Map<string, Cluster>) {
    this.clearClusters()
    clusters.forEach(cluster => this._clusters.set(cluster, new ClusterContext))
  }

  storeNamespaces(namespaces: Map<string, Namespace>) {
    this.clearNamespaces()
    namespaces.forEach(this.addNamespace.bind(this))
  }

  storePods(pods: Map<string, Pod>) {
    this.clearPods()
    pods.forEach(this.addPod.bind(this))
  }

  store(clusters: Map<string, Cluster>, namespaces: Map<string, Namespace>, pods: Map<string, Pod>) {
    this.storeClusters(clusters)
    this.storeNamespaces(namespaces)
    this.storePods(pods)
  }

  clearClusters() {
    this._clusters.clear()
  }

  clearNamespaces() {
    Array.from(this._clusters.values()).forEach(cc => cc.clearNamespaces())
  }

  clearPods() {
    Array.from(this._clusters.values()).forEach(cc => cc.clearPods())
  }

  addCluster(cluster: Cluster) {
    this._clusters.set(cluster, new ClusterContext)
  }

  addNamespace(namespace: Namespace) {
    const clusterContext = this._clusters.get(namespace.cluster)
    if(!clusterContext) {
      console.log("Cluster %s not found for ns %s", namespace.cluster.name, namespace.name)
      throw new ReferenceError("Cluster not found: " + namespace.cluster)
    }
    clusterContext.addNamespace(namespace)
  }
  
  addPod(pod: Pod) {
    const clusterContext = this._clusters.get(pod.namespace.cluster)
    if(!clusterContext) {
      throw new ReferenceError("Cluster not found: " + pod.namespace.cluster)
    }
    clusterContext.addPod(pod)
  }
  
  * getClusters() {
    for(let c of this._clusters.keys()) {
      yield c
    }
  }
  
  hasClusters() : boolean {
    return this._clusters.size >0
  }

  clusters() : Cluster[] {
    return Array.from(this._clusters.keys())
  }

 
  clusterNames() : string[] {
    return Array.from(this._clusters.keys()).map(c => c.text())
  }

  clusterContext(cluster: Cluster) : ClusterContext|undefined {
    return this._clusters.get(cluster)
  }

  
  hasNamespaces() : boolean {
    return this.namespaces().length > 0
  }

  namespaces() : Namespace[] {
    return _.flatMap(Array.from(this._clusters.values()), cc => cc.namespaces())
  }

  namespacesForCluster(cluster: Cluster) : Namespace[] {
    const clusterContext = this._clusters.get(cluster)
    return clusterContext ? clusterContext.namespaces() : []
  }
  
  namespaceNames() : string[] {
    return _.flatMap(Array.from(this._clusters.values()), cc => cc.namespaces()).map(ns => ns.text())
  }

  pods() : Pod[] {
    return _.flatMap(Array.from(this._clusters.values()), cc => cc.pods())
  }

  podsForNamespace(namespace: Namespace) : Pod[] {
    const namespaceContext = this.namespaceContext(namespace)
    return namespaceContext ? namespaceContext.pods() : []
  }
  
  podNames() : string[] {
    return _.flatMap(Array.from(this._clusters.values()), cc => 
                _.flatMap(Array.from(cc._namespaces.values()), 
                    nc => nc.pods())).map(pod => pod.text())
  }

  namespaceContext(namespace: Namespace) : NamespaceContext|undefined {
    const clusterContext = this._clusters.get(namespace.cluster)
    return clusterContext ? clusterContext.namespace(namespace):undefined
  }

  namespace(cluster: Cluster, namespace: Namespace) : NamespaceContext|undefined {
    const clusterContext = this._clusters.get(cluster)
    return clusterContext ? clusterContext.namespace(namespace):undefined
  }
}