/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {Cluster, Namespace} from "../k8s/k8sObjectTypes";
import Context from "../context/contextStore";
import {ActionOnChoice, Choice, BoundActionAct, ActionChoiceMaker} from './actionSpec'

export default class ActionContext {
  inputText?: string
  onActionInitChoices? : ActionOnChoice
  onActionInitChoicesUnbound? : ActionChoiceMaker
  onSkipChoices? : BoundActionAct
  onCancelActionChoice? : () => void
  sleep: (ms) => void = async (ms) => await new Promise(resolve => setTimeout(resolve, ms))

  getClusters: () => Cluster[] = () => Context.clusters || []

  getNamespaces: () => Namespace[] = () => Context.namespaces || []
  
  getSelections: () => Choice[] = () =>  Context.selections || []

}
