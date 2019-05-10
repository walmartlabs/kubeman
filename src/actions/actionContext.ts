import {Cluster, Namespace} from "../k8s/k8sObjectTypes";
import Context from "../context/contextStore";
import {ActionOnChoice, Choice, BoundActionAct, ActionChoiceMaker} from './actionSpec'

export default class ActionContext {
  inputText?: string
  onActionInitChoices? : ActionOnChoice
  onActionInitChoicesUnbound? : ActionChoiceMaker
  onSkipChoices? : BoundActionAct

  getClusters: () => Cluster[] = () => Context.clusters || []

  getNamespaces: () => Namespace[] = () => Context.namespaces || []
  
  getSelections: () => Choice[] = () =>  Context.selections || []

}
