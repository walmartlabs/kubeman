import {Cluster, Namespace, Pod, Item} from "../k8s/contextObjectTypes";
import Context from "../context/contextStore";
import * as k8s from '../k8s/k8sClient'
import {ActionOutputCollector, ActionOnChoice, ActionChoices} from './actionSpec'

export default class ActionContext {
  context?: Context
  onOutput?: ActionOutputCollector
  onChoices? : ActionOnChoice

  getClusters: () => Cluster[] = () => this.context ? this.context.clusters() : []

  getNamespaces: () => Namespace[] = () => this.context ? this.context.namespaces() : []
  
  getPods: () => Pod[] = () => this.context ? this.context.pods() : []
  
  getK8sClients: () => k8s.K8sClient[] = () => 
        this.context ? this.context.clusters().map(k8s.getClientForCluster) : []

  getSelections: () => ActionChoices = () =>  this.context ? this.context.selections : []

}
