import React from "react";
import _ from 'lodash'
import Context from "./contextStore";
import {Cluster, Namespace} from "../k8s/k8sObjectTypes";
import SelectionDialog, {ContextSelectionType} from './selectionDialog'


interface IProps extends React.DOMAttributes<{}> {
  context: Context
  onUpdateContext: (Context) => void
}
interface IState {
  context: Context
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
    context: new Context(),
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
    this.setState({context: nextProps.context})
  }

  
  async onSelection(clusters: Map<string, Cluster>, namespaces: Map<string, Namespace>, filter: string) {
    const {context} = this.state
    await context.store(clusters, namespaces)
    this.props.onUpdateContext(context)
    this.setState({
      context, 
      selectedClusters: clusters,
      selectedNamespaces: namespaces,
      filter,
      showClusters: false, 
      showNamespaces: false, 
      forcedClusterSelection: false,
      forcedNamespaceSelection: false,
    })
  }

  onContextUpdate(context: Context) {
    this.setState({context})
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
    const { context, showClusters, showNamespaces,
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

