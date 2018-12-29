import React from 'react';
import _ from 'lodash'

import { withStyles, WithStyles, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import {AppBar, Button, FormHelperText,} from '@material-ui/core';
import {Dialog, DialogContent, DialogActions, } from '@material-ui/core';
import {Tab, Tabs, CircularProgress} from '@material-ui/core'


import {Cluster, Namespace, Pod, Item, KubeComponent} from "../k8s/k8sObjectTypes";
import * as k8s from '../k8s/k8sContextClient'
import SelectionTable from './selectionTable'
import {selectionDialogTheme} from '../theme/theme'
import PodFilter from './podFilter'
import SelectionManager, 
      {ClusterNamespaces, NamespacePods,
      SelectedClusters, SelectedNamespaces, SelectedPods} from './selectionManager'

import styles from './selectionDialog.styles'


export enum SelectionType {
  Clusters = "Clusters",
  Pattern = "Pattern",
  Namespaces = "Namespaces",
  Pods = "Pods",
}
enum SelectionTabs {
  Clusters = 0,
  Pattern = 1,
  Namespaces = 2,
  Pods = 3,
}

enum SelectionStore {
  selectedClusters = "selectedClusters",
  selectedNamespaces = "selectedNamespaces",
  selectedPods = "selectedPods",
}

interface SelectionDialogProps extends WithStyles<typeof styles> {
  open: boolean
  forced: boolean
  selection: SelectionType
  selectedClusters: SelectedClusters
  selectedNamespaces: SelectedNamespaces
  selectedPods: SelectedPods
  filter: string,
  onSelection: (clusters: SelectedClusters, namespaces: SelectedNamespaces, 
              pods: SelectedPods, filter: string) => any
  onCancel: () => any
}
interface SelectionDialogState {
  activeTab: number
  reportClusterError: boolean
  reportNamespaceError: boolean
  filter: string,
  initialLoading: boolean
}
interface SelectionDialogRefs {
  [k: string]: any
  clusterSelector: any
  namespaceSelector: any
  podSelector: any
}

class SelectionDialog extends React.Component<SelectionDialogProps, SelectionDialogState> {
  static defaultProps = {
    open: false,
    force: false,
    selection: SelectionType.Clusters,
    selectedClusters: new Map,
    selectedNamespaces: new Map,
    selectedPods: new Map,
  }
  state: SelectionDialogState = {
    activeTab: 0,
    reportClusterError: false,
    reportNamespaceError: false,
    filter: '',
    initialLoading: false,
  }
  refs: SelectionDialogRefs = {
    clusterSelector: undefined,
    namespaceSelector: undefined,
    podSelector: undefined,
  }
  closed: boolean = false
  activeTabIndex: number = 0

  componentDidMount() {
    this.closed = false
    this.componentWillReceiveProps(this.props)
  }

  componentWillUnmount() {
    this.closed = true
  }

  componentWillReceiveProps(props: SelectionDialogProps) {
    this.setState({initialLoading: true, filter: props.filter})
    SelectionManager.setSelections(props.selectedClusters, props.selectedNamespaces, props.selectedPods)
    SelectionManager.loadSelectedClustersData()
    .then(result => {
      if(!this.closed) {
        this.setTab(this.activeTabIndex)
        this.setState({initialLoading: false})
      }
    })
  }

  onTabChange(event, tabIndex) {
    this.setTab(tabIndex)
  }

  setTab(tabIndex: number) {
    switch(tabIndex) {
      case SelectionTabs.Clusters:
        this.loadClusters()
        break
      case SelectionTabs.Pattern:
        this.loadPodsForFilter()
        break
      case SelectionTabs.Namespaces:
        this.loadNamespaces()
        break
      case SelectionTabs.Pods:  
        this.loadPods()
        break
    }
    this.activeTabIndex = tabIndex
    this.setState({ activeTab: tabIndex });
  }

  loadClusters() {
    SelectionManager.loadClusters(k8s.getAllClusters())
    this.setState({
      activeTab: 0,
    })
  }

  loadNamespacesIntoState(state: SelectionDialogState) : SelectionDialogState {
    SelectionManager.loadNamespacesForSelectedClusters()
    Object.assign(state, {
      reportClusterError: SelectionManager.isAnyClusterInError,
    })
    return state
  }

  loadNamespaces() {
    this.setState(this.loadNamespacesIntoState.bind(this))
  }

  loadPodsIntoState(allNamespaces: boolean, state: SelectionDialogState) : SelectionDialogState {
    SelectionManager.loadPodsForNamespaces(allNamespaces)
    Object.assign(state, {
      reportNamespaceError: SelectionManager.isAnySelectedClusterInError ||
                            SelectionManager.isAnyNamespaceInError,
    })
    return state
  }

  loadPods() {
    this.setState(this.loadPodsIntoState.bind(this, false))
  }

  loadPodsForFilter() {
    this.setState((state) => {
      state = this.loadNamespacesIntoState(state)
      const {reportClusterError} = state
      if(reportClusterError) {
        return state
      }
      return this.loadPodsIntoState(true, state)
    })
  }

  onSelectComponent(selectionStore: SelectionStore, item: KubeComponent) : boolean {
    const selectedItems: Map<string, KubeComponent> = SelectionManager[selectionStore]
    const selected : boolean = !selectedItems.has(item.text())
    if(selected) {
      selectedItems.set(item.text(), item)
    } else {
      selectedItems.delete(item.text())
    }
    this.setState(state => {
      state[selectionStore.toString()] = selectedItems
      return state
    })
    return selected
  }

  onClusterSelection = async (cluster: Cluster) => {
    const selected = this.onSelectComponent(SelectionStore.selectedClusters, cluster)
    if(selected) {
      await SelectionManager.loadClusterData(cluster)
      this.setTab(this.activeTabIndex)
    } else {
      SelectionManager.deselectCluster(cluster)
    }
  }

  onNamespaceSelection = (namespace: Namespace) => {
    const selected = this.onSelectComponent(SelectionStore.selectedNamespaces, namespace)
    if(!selected) {
      SelectionManager.deselectNamespace(namespace)
    }
  }

  onApplyFilter = (filter: string, namespaces: Namespace[], pods: Pod[]) => {
    SelectionManager.setFilteredSelections(namespaces, pods)
    this.setState({filter})
  }

  onEntering = () => {
    const {selection} = this.props
    switch(selection) {
      case SelectionType.Clusters:
        this.setTab(SelectionTabs.Clusters)
        break
      case SelectionType.Pattern:
        this.setTab(SelectionTabs.Pattern)
        break
      case SelectionType.Namespaces:
        this.setTab(SelectionTabs.Namespaces)
        break
      case SelectionType.Pods:
        this.setTab(SelectionTabs.Pods)
        break
    }
  }

  onCancel = () => {
    this.props.onCancel()
  }

  onOk = () => {
    const {filter} = this.state
    this.props.onSelection(
      SelectionManager.selectedClusters, 
      SelectionManager.selectedNamespaces, 
      SelectionManager.selectedPods, 
      filter
    )
  }

  render() {
    const { classes, open, forced } = this.props;
    const useDarkTheme = global['useDarkTheme']
    const { activeTab, initialLoading, reportClusterError, reportNamespaceError, filter } = this.state
    const selectedClusters = SelectionManager.selectedClusters
    const selectedNamespaces = SelectionManager.selectedNamespaces
    const selectedPods = SelectionManager.selectedPods
    const clusters = SelectionManager.clusters
    const namespaces = SelectionManager.clusterNamespaces
    const pods = SelectionManager.namespacePods
    const clustersInError = SelectionManager.clustersInError
    const namespacesInError = SelectionManager.namespacesInError
    const loading = SelectionManager.isLoading

    const theme = createMuiTheme(selectionDialogTheme.getTheme(useDarkTheme));
    
    return (
      <MuiThemeProvider theme={theme}>
        <Dialog
          onEntering={this.onEntering}
          aria-labelledby="confirmation-dialog-title"
          onClose={this.onCancel}
          open={open}
        >
          <DialogContent className={classes.dialogContent}>
            <AppBar position="static">
              <Tabs value={activeTab}
                  onChange={this.onTabChange.bind(this)} >
                <Tab label="Clusters" />
                <Tab label="Select by Pattern" disabled={selectedClusters.size === 0} />
                <Tab label="Namespaces" disabled={selectedClusters.size === 0} />
                <Tab label="Pods" disabled={selectedNamespaces.size === 0} />
              </Tabs>
            </AppBar>
            {initialLoading && <CircularProgress className={classes.loading} />}
            {!initialLoading && activeTab === SelectionTabs.Clusters &&  
              <div>
                <SelectionTable 
                    innerRef={this.refs.clusterSelector}
                    title="Clusters" 
                    table={clusters}
                    selections={selectedClusters}
                    grouped={false}
                    maxSelect={3}
                    onSelection={this.onClusterSelection}
                />
              </div>}
            {loading && activeTab !== SelectionTabs.Clusters && <CircularProgress className={classes.loading} />}
            {!loading && activeTab === SelectionTabs.Pattern &&
              <PodFilter filter={filter} onApplyFilter={this.onApplyFilter} />
            }
            {!loading && activeTab === SelectionTabs.Namespaces &&  
              <div>
                {reportClusterError && 
                <FormHelperText style={{fontSize: 14, marginTop: 20, color: 'red'}}>
                  Failed to load data for the following cluster(s): {clustersInError}
                </FormHelperText>
                }
                {!reportClusterError && 
                <SelectionTable 
                    innerRef={this.refs.namespaceSelector}
                    title="Namespaces" 
                    table={namespaces}
                    selections={selectedNamespaces}
                    grouped={true}
                    onSelection={this.onNamespaceSelection}
                />
                }
              </div>}
            {!loading && activeTab === SelectionTabs.Pods &&  
              <div>
                {reportNamespaceError && 
                <FormHelperText style={{fontSize: 14, verticalAlign: 'middle'}}>
                  Failed to load data for the following namespace(s): {namespacesInError}
                </FormHelperText>
                }
                {!reportNamespaceError && 
                  <SelectionTable 
                      innerRef={this.refs.podSelector}
                      title="Pods" 
                      table={pods}
                      selections={selectedPods}
                      grouped={true}
                      onSelection={this.onSelectComponent.bind(this, SelectionStore.selectedPods)}
                  />
                }
              </div>}
          </DialogContent>
          <DialogActions className={classes.dialogActions}>
            <Button onClick={this.onCancel} className={classes.dialogButton} >
              Cancel
            </Button>
            <Button onClick={this.onOk} className={classes.dialogButton} >
              Ok
            </Button>
          </DialogActions>
        </Dialog>
      </MuiThemeProvider>  
    );
  }
}

export default withStyles(styles)(SelectionDialog);
