import * as k8s from "./k8sClient";

export enum KubeComponentType {
  Cluster = "Cluster",
  Namespace = "Namespace",
  Pod = "Pod",
  Item = "Item"
}

export interface KubeComponent {
  name: string
  type: KubeComponentType
  text()
  toString()
}

export class Cluster implements KubeComponent {
  name: string
  type: KubeComponentType = KubeComponentType.Cluster
  namespaces: Namespace[] = []
  k8sClient: k8s.K8sClient
  hasIstio: boolean = false

  constructor(name: string) {
    this.name = name
    this.k8sClient = {} as k8s.K8sClient
  }
  namespace(name: string) {
    const matches = this.namespaces.filter(ns => ns.name === name)
    return matches.length > 0 ? matches[0] : undefined
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

export class Namespace implements KubeComponent {
  name: string
  type: KubeComponentType = KubeComponentType.Namespace
  cluster: Cluster
  pods: Pod[] = []
  items: Item[] = []
  constructor(name?: string, cluster?: Cluster) {
    this.name = name || ''
    this.cluster = cluster || new Cluster('');
  }
  pod(name: string) {
    const matches = this.pods.filter(pod => pod.name === name)
    return matches.length > 0 ? matches[0] : undefined
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

export class Pod implements KubeComponent {
  name: string
  type: KubeComponentType = KubeComponentType.Pod
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

export class Item implements KubeComponent {
  name: string
  type: KubeComponentType = KubeComponentType.Item
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

export type KubeComponentArray = Array<KubeComponent>

export interface Metadata {
  name: string
  namespace: string
  creationTimestamp: string
  labels: string[]
  annotations: string[]
}

export interface ContainerInfo {
  name: string
  image: string
  imagePullPolicy?: string
  args?: string[]
  command?: string[]
  ports?: any[]
  volumeMounts?: any[]
  workingDir?: string
  livenessProbe?: any
  readinessProbe?: any
  resources?: any
  securityContext?: any
}

export interface ContainerStatus {
  containerID: string
  name: string
  image: string
  imageID: string
  ready: boolean
  restartCount: number
  state?: any
  lastState?: any
  message?: string
}

export interface PodInfo extends Metadata{
  activeDeadlineSeconds?: any
  affinity?: any
  dnsConfig?: any
  dnsPolicy?: any
  hostAliases?: any
  hostIPC?: any
  hostNetwork?: any
  hostPID?: any
  hostName?: string
  nodeName?: string
  nodeSelector?: any
  priority?: any
  priorityClassName?: string
  readinessGates?: any
  restartPolicy?: any
  runtimeClassName?: string
  schedulerName?: string
  securityContext?: any
  serviceAccount?: any
  serviceAccountName?: string
  shareProcessNamespace?: any
  subdomain?: any
  terminationGracePeriodSeconds?: number
}

export interface PodTemplate extends PodInfo {
  containers: ContainerInfo[]
  initContainers?: ContainerInfo[]
  volumes?: any[]
  yaml?: any
}

export interface PodStatus {
  podIP?: string
  hostIP?: string
  message?: string
  reason?: string
  phase?: string
  qosClass?: string
  startTime?: any
  conditions?: any[]
  containerStatuses?: ContainerStatus[]
  initContainerStatuses?: ContainerStatus[]
}

export interface PodDetails extends PodTemplate, PodStatus {
}

export interface PodContainerDetails {
  podInfo: PodInfo
  containerInfo: ContainerInfo
  podStatus?: PodStatus
  containerStatus?: ContainerStatus
}

export interface Port {
  name: string,
  protocol: string,
  port: number,
  targetPort?: number,
  nodePort?: number,
}

export interface ServiceDetails extends Metadata {
  clusterIP: string,
  externalIPs?: any,
  externalName?: string,
  externalTrafficPolicy?: any,
  healthCheckNodePort?: any,
  loadBalancerIP?: any,
  loadBalancerSourceRanges?: any,
  ports: Port[],
  publishNotReadyAddresses?: any,
  selector?: any[],
  sessionAffinity?: any,
  sessionAffinityConfig?: any,
  type: any,
  loadBalancer?: any,
  yaml?: any
}