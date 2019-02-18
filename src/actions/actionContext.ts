import {Cluster, Namespace, Pod, Item} from "../k8s/k8sObjectTypes";
import Context from "../context/contextStore";
import * as k8s from '../k8s/k8sClient'
import {ActionOutputCollector, ActionStreamOutputCollector, ActionOnChoice, Choice, BoundActionAct} from './actionSpec'

export default class ActionContext {
  context?: Context
  inputText?: string
  onActionInitChoices? : ActionOnChoice
  onSkipChoices? : BoundActionAct

  getClusters: () => Cluster[] = () => this.context ? this.context.clusters : []

  getNamespaces: () => Namespace[] = () => this.context ? this.context.namespaces : []
  
  getPods: () => Pod[] = () => this.context ? this.context.pods : []

  getSelections: () => Choice[] = () =>  this.context ? this.context.selections : []

}
