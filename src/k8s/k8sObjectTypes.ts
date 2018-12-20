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
  containers: string[] = []

  constructor(name?: string, namespace?: Namespace, containers?: string[]) {
    this.name = name || ''
    this.namespace = namespace || new Namespace()
    containers && (this.containers = containers.concat())
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

export interface Metadata {
  name: string
  creationTimestamp: string
  labels: string[]
}

export interface PodTemplate extends Metadata {
  containers: any[]
  initContainers: any[]
  activeDeadlineSeconds: any
  affinity: any
  dnsConfig: any
  dnsPolicy: any
  hostAliases: any
  hostIPC: any
  hostNetwork: any
  hostPID: any
  hostname: string
  nodeName: string
  nodeSelector: any
  priority: any
  priorityClassName: string
  readinessGates: any
  restartPolicy: any
  runtimeClassName: string
  schedulerName: string
  securityContext: any
  serviceAccount: any
  serviceAccountName: string
  shareProcessNamespace: any
  subdomain: any
  terminationGracePeriodSeconds: number
  volumes: any[]  
}

export interface PodDetails extends PodTemplate {
  conditions: any[]
  containerStatuses: any[]
}
