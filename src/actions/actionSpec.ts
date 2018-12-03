import Context from "../context/contextStore";
import {K8sClient} from '../k8s/k8sClient'
import {Cluster, Namespace, Pod, Item} from "../k8s/contextObjectTypes";

export type ActionOutput = string[][]
export type ActionGroupSpecs = ActionGroupSpec[]

export type ActionOutputCollector = (output: string[]) => void

export type methodGetClusters = () => Cluster[]
export type methodGetK8sClients = () => K8sClient[]
export type methodGetNamespaces = () => Namespace[]

type ClusterActionMethod = (methodGetClusters, methodGetK8sClients) => void
type NamespaceActionMethod = (methodGetClusters, methodGetK8sClients, methodGetNamespaces) => void

export enum ActionCategory {
  Common = "Common",
  Cluster = "Cluster",
  Namespace = "Namespace",
  Pod = "Pod",
}

export enum ActionOutputStyle {
  Text = "Text",
  Table = "Table",
  Compare = "Compare",
  Health = "Health",
}

export interface ActionSpec {
  name: string
  act?: (...any) => void
  execute?: (executor?: Function) => void
  render?: (any?) => string[][]
  outputStyle?: ActionOutputStyle
}

export interface ClusterActionSpec extends ActionSpec {
  act: ClusterActionMethod
}

export interface NamespaceActionSpec extends ActionSpec {
  act: NamespaceActionMethod
}

export interface ActionGroupSpec {
  order: number
  context: string
  actions: ActionSpec[]
}

export function isActionSpec(obj: any) : obj is ActionSpec {
  const func = obj.act || obj.execute || obj.render
  return obj && obj.name && func && func instanceof Function
}

export function isClusterActionSpec(obj: any) : obj is ClusterActionSpec {
  return isActionSpec(obj) 
         && obj.act instanceof Function
         && obj.act.length === 3
}

export function isNamespaceActionSpec(obj: any) : obj is NamespaceActionSpec {
  return isActionSpec(obj) 
         && obj.act instanceof Function
         && obj.act.length === 4
}

export function isActionGroupSpec(obj: any) : obj is ActionGroupSpec {
  if(obj && obj.context && obj.actions && obj.actions.length > 0) {
    return obj.actions.filter(action => !isActionSpec(action)).length == 0
  }
  return false
}
