import Context from "../context/contextStore";
import {K8sClient} from '../k8s/k8sClient'

export type ActionOutput = string[][]
export type ActionGroupSpecs = ActionGroupSpec[]

export type ActionOutputCollector = (output: string[]) => void

export type methodGetClusters = () => string[]
export type methodGetK8sClients = () => K8sClient[]
type ClusterActionMethod = (methodGetClusters, methodGetK8sClients) => void

export enum ActionCategory {
  Common = "Common",
  Cluster = "Cluster",
  Namespace = "Namespace",
  Pod = "Pod",
}

export enum ActionOutputStyle {
  Text = "Text",
  Table = "Table",
  Health = "Health"
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

export function isActionsSpec(obj: any) : obj is ActionGroupSpec {
  if(obj && obj.context && obj.actions && obj.actions.length > 0) {
    return obj.actions.filter(action => !isActionSpec(action)).length == 0
  }
  return false
}
