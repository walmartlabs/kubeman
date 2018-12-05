import Context from "../context/contextStore";
import {K8sClient} from '../k8s/k8sClient'
import {Cluster, Namespace, Pod, Item} from "../k8s/contextObjectTypes";

export enum ActionCategory {
  Common = "Common",
  Cluster = "Cluster",
  Namespace = "Namespace",
  Pod = "Pod",
}

export enum ActionOutputStyle {
  None = "None",
  Text = "Text",
  Table = "Table",
  Compare = "Compare",
  Health = "Health",
}

export type ActionOutput = any[][]
export type ActionGroupSpecs = ActionGroupSpec[]

export type ActionOutputCollector = (output: string[]) => void

export type methodGetClusters = () => Cluster[]
export type methodGetK8sClients = () => K8sClient[]
export type methodGetNamespaces = () => Namespace[]
export type methodGetPods = () => Pod[]
export type outputMethod = (ActionOutput) => void


type ClusterActionMethod = (methodGetClusters, methodGetK8sClients, outputMethod) => void
type NamespaceActionMethod = (methodGetClusters, methodGetNamespaces, methodGetK8sClients, outputMethod) => void
type PodActionMethod = (methodGetPods, outputMethod) => void

export interface ActionSpec {
  name: string
  order?: number
  act: (...any) => void
  outputStyle?: ActionOutputStyle
}

export interface ClusterActionSpec extends ActionSpec {
  act: ClusterActionMethod
}

export interface NamespaceActionSpec extends ActionSpec {
  act: NamespaceActionMethod
}

export interface PodActionSpec extends ActionSpec {
  act: PodActionMethod
}

export interface ActionGroupSpec {
  order: number
  context: string
  actions: ActionSpec[]
}

export function isActionSpec(obj: any) : obj is ActionSpec {
  return obj && obj.name && obj.act && obj.act instanceof Function
}

export function isClusterActionSpec(obj: any) : obj is ClusterActionSpec {
  return isActionSpec(obj) 
         && obj.act.length === 3
}

export function isNamespaceActionSpec(obj: any) : obj is NamespaceActionSpec {
  return isActionSpec(obj) 
         && obj.act.length === 4
}

export function isPodActionSpec(obj: any) : obj is PodActionSpec {
  return isActionSpec(obj) 
         && obj.act.length === 2
}

export function isActionGroupSpec(obj: any) : obj is ActionGroupSpec {
  if(obj && obj.context && obj.actions && obj.actions.length > 0) {
    return obj.actions.filter(action => !isActionSpec(action)).length == 0
  }
  return false
}
