export class Cluster {
  name: string
  namespaces: Namespace[] = []
  constructor(name: string) {
    this.name = name
  }
  get group() {
    return null
  }
  text() {
    return this.name
  }
  toString() {
    return "["+this.text()+"]"
  }
}

export class Namespace {
  name: string
  cluster: Cluster
  pods: Pod[] = []
  items: Item[] = []
  constructor(name?: string, cluster?: Cluster) {
    this.name = name || ''
    this.cluster = cluster || new Cluster('');
  }
  get group() {
    return "[" + this.cluster.name + "]"
  }
  text() {
    return this.name + "@" + this.group
  }
  toString() {
    return "["+this.text()+"]"
  }
}

export class Pod {
  name: string
  namespace: Namespace
  constructor(name?: string, namespace?: Namespace) {
    this.name = name || ''
    this.namespace = namespace || new Namespace()
  }
  get group() {
    return this.namespace.name + " [" + this.namespace.cluster.name + "]"
  }
  text() {
    return this.name + "@" + this.group
  }
  toString() {
    return "["+this.text()+"]"
  }
}

export class Item {
  name: string
  namespace: Namespace
  constructor(name?: string, namespace?: Namespace) {
    this.name = name || ''
    this.namespace = namespace || new Namespace()
  }
  get group() {
    return "<" + this.namespace.name + "><" + this.namespace.cluster.name + ">"
  }
  text() {
    return this.name + "@" + this.group
  }
  toString() {
    return "["+this.text()+"]"
  }
}

export type KubeComponent = Cluster|Namespace|Pod
export type KubeComponentArray = Array<KubeComponent>
