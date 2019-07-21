/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import React from 'react';
import _ from 'lodash'
import { withStyles, WithStyles, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import {AppBar, Button, FormHelperText,} from '@material-ui/core';
import {Dialog, DialogContent, DialogActions, } from '@material-ui/core';
import {Tab, Tabs, CircularProgress} from '@material-ui/core'
import {Cluster, Namespace, KubeComponent} from "../k8s/k8sObjectTypes";
import * as k8s from '../k8s/k8sContextClient'
import SelectionTable from './selectionTable'
import {selectionDialogTheme} from '../theme/theme'
import SelectionManager, {SelectedClusters, SelectedNamespaces} from './selectionManager'
import styles from './selectionDialog.styles'


export enum ContextSelectionType {
  Clusters = "Clusters",
  Pattern = "Pattern",
  Namespaces = "Namespaces",
}
enum SelectionTabs {
  Clusters = 0,
  Namespaces = 1,
}

enum SelectionStore {
  selectedClusters = "selectedClusters",
  selectedNamespaces = "selectedNamespaces",
}

interface SelectionDialogProps extends WithStyles<typeof styles> {
  open: boolean
  forced: boolean
  selection: ContextSelectionType
  selectedClusters: SelectedClusters
  selectedNamespaces: SelectedNamespaces
  filter: string,
  onSelection: (clusters: SelectedClusters, namespaces: SelectedNamespaces, filter: string) => any
  onCancel: () => any
}
interface SelectionDialogState {
  activeTab: number
  reportClusterError: boolean
  reportNamespaceError: boolean
  filter: string,
  initialLoading: boolean
  updating: boolean
}

class SelectionDialog extends React.Component<SelectionDialogProps, SelectionDialogState> {
  static defaultProps = {
    open: false,
    force: false,
    selection: ContextSelectionType.Clusters,
    selectedClusters: new Map,
    selectedNamespaces: new Map,
  }
  state: SelectionDialogState = {
    activeTab: 0,
    reportClusterError: false,
    reportNamespaceError: false,
    filter: '',
    initialLoading: false,
    updating: false,
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
    SelectionManager.setSelections(props.selectedClusters, props.selectedNamespaces)
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
      case SelectionTabs.Namespaces:
        this.loadNamespaces()
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

  loadNamespaces() {
    this.setState(state => {
      SelectionManager.loadNamespacesForSelectedClusters()
      Object.assign(state, {
        reportClusterError: SelectionManager.isAnyClusterInError,
      })
      return state
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
    const loaded = selected ? await SelectionManager.loadClusterData(cluster) : false
    if(!loaded) {
      SelectionManager.deselectCluster(cluster)
    }
    this.setTab(this.activeTabIndex)
    this.setState({reportClusterError: SelectionManager.isAnyClusterInError})
  }

  onNamespaceSelection = (namespace: Namespace) => {
    const selected = this.onSelectComponent(SelectionStore.selectedNamespaces, namespace)
    if(!selected) {
      SelectionManager.deselectNamespace(namespace)
    }
  }

  onEntering = () => {
    const {selection} = this.props
    switch(selection) {
      case ContextSelectionType.Clusters:
        this.setTab(SelectionTabs.Clusters)
        break
      case ContextSelectionType.Namespaces:
        this.setTab(SelectionTabs.Namespaces)
        break
    }
  }

  onClearSelections = () => {
    const { activeTab } = this.state
    if(activeTab === SelectionTabs.Clusters) {
      SelectionManager.deselectAllClusters()
    } else if(activeTab === SelectionTabs.Namespaces) {
      SelectionManager.deselectAllNamespaces()
    }
    this.forceUpdate()
  }

  onCancel = () => {
    this.props.onCancel()
  }

  onOk = () => {
    let {filter} = this.state
    this.setState({updating: true})
    const update = async () => 
      this.props.onSelection(
        SelectionManager.selectedClusters, 
        SelectionManager.selectedNamespaces, 
        filter
      )
    update()
  }

  render() {
    const useDarkTheme = global['useDarkTheme']
    const { classes, open, forced } = this.props;
    const { activeTab, initialLoading, filter, updating,
            reportClusterError, reportNamespaceError } = this.state
    const selectedClusters = SelectionManager.selectedClusters
    const selectedNamespaces = SelectionManager.selectedNamespaces
    const clusters = SelectionManager.clusters
    const namespaces = SelectionManager.clusterNamespaces
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
                <Tab label="Namespaces" disabled={selectedClusters.size === 0} />
              </Tabs>
            </AppBar>
            {initialLoading && 
              <CircularProgress variant="indeterminate" disableShrink
                      size={48} thickness={4}
                      className={classes.loading} />}
            {!initialLoading && activeTab === SelectionTabs.Clusters &&  
              <div>
                {reportClusterError && 
                <FormHelperText style={{fontSize: 14, marginTop: 20, color: 'red'}}>
                  Failed to load data for the following cluster(s): {clustersInError.join(", ")}
                </FormHelperText>
                }
                <SelectionTable 
                    title="Clusters" 
                    table={clusters}
                    selections={selectedClusters}
                    grouped={false}
                    maxSelect={3}
                    onSelection={this.onClusterSelection}
                />
              </div>}
            {loading && activeTab !== SelectionTabs.Clusters && 
              <CircularProgress variant="indeterminate" disableShrink
                    size={48} thickness={4}
                    className={classes.loading} />}
            {!loading && activeTab === SelectionTabs.Namespaces &&  
              <div>
                {reportClusterError && 
                <FormHelperText style={{fontSize: 14, marginTop: 20, color: 'red'}}>
                  Failed to load data for the following cluster(s): {clustersInError}
                </FormHelperText>
                }
                {!reportClusterError && 
                <SelectionTable 
                    title="Namespaces" 
                    table={namespaces}
                    selections={selectedNamespaces}
                    grouped={true}
                    onSelection={this.onNamespaceSelection}
                />
                }
              </div>}
            {updating && 
              <CircularProgress variant="indeterminate" disableShrink
                  size={48} thickness={4}
                  className={classes.updating} />}
          </DialogContent>
          <DialogActions className={classes.dialogActions}>
            <div className={classes.floatLeft}>
              <Button onClick={this.onClearSelections} className={classes.dialogButton} disabled={updating} >
                Clear Selections
              </Button>
            </div>
            <div className={classes.floatRight}>
              <Button onClick={this.onCancel} className={classes.dialogButton} disabled={updating} >
                Cancel
              </Button>
              <Button onClick={this.onOk} className={classes.dialogButton} disabled={updating} >
                Ok
              </Button>
            </div>
          </DialogActions>
        </Dialog>
      </MuiThemeProvider>  
    );
  }
}

export default withStyles(styles)(SelectionDialog);
