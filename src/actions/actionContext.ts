import {Cluster, Namespace} from "../k8s/k8sObjectTypes";
import Context from "../context/contextStore";
import {ActionOnChoice, Choice, BoundActionAct} from './actionSpec'

export default class ActionContext {
  context?: Context
  inputText?: string
  onActionInitChoices? : ActionOnChoice
  onSkipChoices? : BoundActionAct

  getClusters: () => Cluster[] = () => this.context ? this.context.clusters : []

  getNamespaces: () => Namespace[] = () => this.context ? this.context.namespaces : []
  
  getSelections: () => Choice[] = () =>  this.context ? this.context.selections : []

}
