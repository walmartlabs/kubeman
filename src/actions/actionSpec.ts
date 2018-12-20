import ActionContext from './actionContext'

export enum ActionContextType {
  Common = "Common",
  Cluster = "Cluster",
  Namespace = "Namespace",
  Pod = "Pod",
  Other = "Other",
}

export const ActionContextOrder = {}
ActionContextOrder[ActionContextType.Common] = 1
ActionContextOrder[ActionContextType.Cluster] = 10
ActionContextOrder[ActionContextType.Namespace] = 100
ActionContextOrder[ActionContextType.Pod] = 1000
ActionContextOrder[ActionContextType.Other] = 10000

export enum ActionOutputStyle {
  None = "None",
  Text = "Text",
  Table = "Table",
  Compare = "Compare",
  Log = "Log"
}

export type ActionOutput = any[][]
export type ActionChoices = any[]
export type ActionAct = (actionContext: ActionContext) => void
export type BoundActionAct = () => void

export type ActionOutputCollector = (output: ActionOutput|string[], style: ActionOutputStyle) => void
export type ActionStreamOutputCollector = (output: ActionOutput|string[]) => void
export type ActionChoiceMaker = (act: BoundActionAct, title: string, choices: ActionChoices, minChoices: number, maxChoices: number) => void
export type ActionOnChoice = (title: string, choices: ActionChoices, minChoices: number, maxChoices: number) => void

export type ActionGroupSpecs = ActionGroupSpec[]


export interface ActionSpec {
  name: string
  context?: ActionContextType
  order?: number
  act: ActionAct
  choose?: ActionAct,
  stop?: ActionAct,
  [x: string]: any
}

export interface BoundAction extends ActionSpec {
  act: BoundActionAct
  stop?: BoundActionAct,
}

export interface ActionGroupSpec {
  order?: number
  title?: string
  context: ActionContextType
  actions: ActionSpec[]
  [x: string]: any
}

export function isActionSpec(obj: any) : obj is ActionSpec {
  return obj && obj.name && obj.act && obj.act instanceof Function
}

export function isActionGroupSpec(obj: any) : obj is ActionGroupSpec {
  if(obj && obj.context && obj.actions && obj.actions.length > 0) {
    return obj.actions.filter(action => !isActionSpec(action)).length == 0
  }
  return false
}
