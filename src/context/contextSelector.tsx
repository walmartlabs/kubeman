import React from "react";
import _ from 'lodash'
import Context from "./contextStore";
import * as k8s from '../k8s/k8sClient'
import {Cluster, Namespace, Pod, Item} from "../k8s/k8sTypes";
import SelectionDialog, {SelectionType} from './selectionDialog'


interface IProps extends React.DOMAttributes<{}> {
  context: Context
  useDarkTheme: boolean
  onUpdateContext: (Context) => void
}
interface IState {
  context: Context
  showClusters: boolean
  showNamespaces: boolean
  showPods: boolean
  forcedClusterSelection: boolean
  forcedNamespaceSelection: boolean
  forcedPodSelection: boolean
  selectedClusters: Map<string, Cluster>
  selectedNamespaces: Map<string, Namespace>
  selectedPods: Map<string, Pod>
  filter: string
}

export default class ContextSelector extends React.Component<IProps, IState> {

  state: IState = {
    context: new Context(),
    showClusters: false,
    showNamespaces: false,
    showPods: false,
    forcedClusterSelection: false,
    forcedNamespaceSelection: false,
    forcedPodSelection: false,
    selectedClusters: new Map,
    selectedNamespaces: new Map,
    selectedPods: new Map,
    filter: '',
  }

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(nextProps: IProps) {
    this.setState({context: nextProps.context})
  }

  
  onSelection(clusters: Map<string, Cluster>, namespaces: Map<string, Namespace>, 
              pods: Map<string, Pod>, filter: string) {
    const {context} = this.state
    context.store(clusters, namespaces, pods)
    this.props.onUpdateContext(context)
    this.setState({
      context, 
      selectedClusters: clusters,
      selectedNamespaces: namespaces,
      selectedPods: pods,
      filter,
      showClusters: false, 
      showNamespaces: false, 
      showPods: false, 
      forcedClusterSelection: false,
      forcedNamespaceSelection: false,
      forcedPodSelection: false
    })
  }

  onContextUpdate(context: Context) {
    this.setState({context})
  }

  onCancelSelection() {
    this.setState({
      showClusters: false, 
      showNamespaces: false, 
      showPods: false, 
      forcedClusterSelection: false,
      forcedNamespaceSelection: false,
      forcedPodSelection: false
    })
  }

  selectClusters() {
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

  selectPods() {
    const {selectedNamespaces} = this.state
    if(!selectedNamespaces || !selectedNamespaces.size || selectedNamespaces.size ==  0) {
      this.setState({forcedNamespaceSelection: true})
      this.selectNamespaces()
    } else {
      this.setState({showPods: true})
    }
  }

  onKeyPress(event: KeyboardEvent) {
    console.log("event.charCode = " + event.charCode)
    console.log("event.key = " + event.key)
    console.log("event.which = " + event.which)
    switch(event.which) {
      case 99:
        this.selectClusters()
        break
      case 110:
        this.selectNamespaces()
        break
      case 112:
        this.selectPods()
        break
    }
  }

  render() {
    const {useDarkTheme} = this.props
    const { context, showClusters, showNamespaces, showPods,
            forcedClusterSelection, forcedNamespaceSelection, forcedPodSelection,
            selectedClusters, selectedNamespaces, selectedPods, filter } = this.state;
    const showDialog = showClusters || showNamespaces || showPods
    const selection = showClusters ? SelectionType.Clusters :
                        showNamespaces ? SelectionType.Namespaces : SelectionType.Pods
    
    return (
      <div>
        {showDialog && 
        <SelectionDialog 
          selection={selection}
          selectedClusters={selectedClusters}
          selectedNamespaces={selectedNamespaces}
          selectedPods={selectedPods}
          filter={filter}
          open={showDialog}
          useDarkTheme={useDarkTheme}
          forced={forcedClusterSelection||forcedNamespaceSelection||forcedPodSelection}
          onCancel={this.onCancelSelection.bind(this)}
          onSelection={this.onSelection.bind(this)} />}
      </div>
    )
  }
}

