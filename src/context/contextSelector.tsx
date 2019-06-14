/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import React from "react";
import _ from 'lodash'
import Context from "./contextStore";
import {Cluster, Namespace} from "../k8s/k8sObjectTypes";
import SelectionDialog, {ContextSelectionType} from './selectionDialog'


interface IProps extends React.DOMAttributes<{}> {
  onUpdateContext: () => void
}
interface IState {
  showClusters: boolean
  showNamespaces: boolean
  forcedClusterSelection: boolean
  forcedNamespaceSelection: boolean
  selectedClusters: Map<string, Cluster>
  selectedNamespaces: Map<string, Namespace>
  filter: string
}

export default class ContextSelector extends React.Component<IProps, IState> {

  state: IState = {
    showClusters: false,
    showNamespaces: false,
    forcedClusterSelection: false,
    forcedNamespaceSelection: false,
    selectedClusters: new Map,
    selectedNamespaces: new Map,
    filter: '',
  }

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(nextProps: IProps) {
    const selectedClusters = new Map<string, Cluster>()
    const selectedNamespaces = new Map<string, Namespace>()
    Context.clusters.forEach(c => selectedClusters.set(c.text(), c))
    Context.namespaces.forEach(ns => selectedNamespaces.set(ns.text(), ns))
    this.setState({ selectedClusters, selectedNamespaces })
  }
  
  async onSelection(clusters: Map<string, Cluster>, namespaces: Map<string, Namespace>, filter: string) {
    await Context.store(clusters, namespaces)
    this.props.onUpdateContext()
    this.setState({
      selectedClusters: clusters,
      selectedNamespaces: namespaces,
      filter,
      showClusters: false, 
      showNamespaces: false, 
      forcedClusterSelection: false,
      forcedNamespaceSelection: false,
    })
  }

  onCancelSelection() {
    this.setState({
      showClusters: false, 
      showNamespaces: false, 
      forcedClusterSelection: false,
      forcedNamespaceSelection: false,
    })
  }

  showContextDialog() {
    this.setState({showClusters: true})
  }

  selectNamespaces() {
    const {selectedClusters} = this.state
    if(!selectedClusters || !selectedClusters.size || selectedClusters.size ==  0) {
      this.setState({showClusters: true, forcedClusterSelection: true})
    } else {
      this.setState({showNamespaces: true})
    }
  }

  render() {
    const { showClusters, showNamespaces,
            forcedClusterSelection, forcedNamespaceSelection,
            selectedClusters, selectedNamespaces, filter } = this.state;
    const showDialog = showClusters || showNamespaces
    const selection = showNamespaces ? ContextSelectionType.Namespaces : ContextSelectionType.Clusters
    
    return (
      <div>
        {showDialog && 
        <SelectionDialog 
          selection={selection}
          selectedClusters={selectedClusters}
          selectedNamespaces={selectedNamespaces}
          filter={filter}
          open={showDialog}
          forced={forcedClusterSelection||forcedNamespaceSelection}
          onCancel={this.onCancelSelection.bind(this)}
          onSelection={this.onSelection.bind(this)} />}
      </div>
    )
  }
}

