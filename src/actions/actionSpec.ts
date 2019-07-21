/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import ActionContext from './actionContext'

export enum ActionContextType {
  Cluster = "Cluster",
  Namespace = "Namespace",
  Istio = "Istio",
  Other = "Other",
}

export enum ActionContextOrder {
  Cluster = 1,
  Events = 10,
  Resources = 20,
  Namespace = 50,
  Deployment = 100,
  Service = 200,
  Pod = 300,
  Istio = 500,
  Analysis = 1000,
  Other = 10000,
}

export enum ActionOutputStyle {
  None = "None",
  Text = "Text",
  Table = "Table",
  TableWithHealth = "TableWithHealth",
  Compare = "Compare",
  Log = "Log",
  Mono = "Mono",
  LogWithHealth = "LogWithHealth",
}

export enum SelectionType {
  Namespace = "Namespace",
  Pod = "Pod",
  Service = "Service",
  Container = "Container",
  Sidecar = "Sidecar"
}

export interface Choice {
  displayItem: any[]
  data: any
}
export type ActionChoiceMaker = (act: BoundActionAct, title: string, choices: Choice[], minChoices: number, maxChoices: number, showChoiceSubItems: boolean, previousSelections: Choice[]) => void
export type ActionOnChoice = (title: string, choices: Choice[], minChoices: number, maxChoices: number, showChoiceSubItems: boolean, previousSelections: Choice[]) => void


export type ActionOutput = any[][]
export type ActionAct = (actionContext: ActionContext, ...params) => void
export type ActionDirectAct = (...params) => void
export type BoundActionAct = (...params) => void
export type BoundActionDirectAct = (...params) => void
export type ActionOutputCollector = (output: ActionOutput, style: ActionOutputStyle) => void
export type ActionStreamOutputCollector = (output: ActionOutput|string[]) => void
export type ActionOnInfo = (title: string, info: any[]) => void

export type ActionGroupSpecs = ActionGroupSpec[]


export interface ActionSpec {
  name: string
  context?: ActionContextType
  order?: number
  outputRowLimit?: number
  showJSON?: boolean
  options?: () => string[]
  choose?: ActionAct
  act: ActionAct
  directAct?: ActionDirectAct
  react?: ActionAct
  refresh?: ActionAct
  stop?: ActionAct
  clear?: ActionAct
  onActionOption?: ActionAct
  filterSelections?: (selections: []) => any[]
  onOutput?: ActionOutputCollector
  onStreamOutput?: ActionStreamOutputCollector
  showChoices?: ActionOnChoice
  showInfo?: ActionOnInfo
  setColumnWidths?: (...widths) => void
  setScrollMode?: (boolean) => void
  showOutputLoading?: (boolean) => void
  autoRefreshDelay?: number
  selectionType?: SelectionType
  hideFromContextMenu?: boolean
  sleep?: (number) => void
  [x: string]: any
}

export interface BoundAction extends ActionSpec {
  chooseAndAct: BoundActionAct
  directAct?: BoundActionDirectAct
  stop?: BoundActionAct
  react?: BoundActionAct
  refresh?: BoundActionAct
  clear?: BoundActionAct
  onActionOption?: BoundActionAct
  canReact: boolean
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
