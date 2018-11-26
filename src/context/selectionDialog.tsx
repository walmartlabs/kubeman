import React from 'react';
import _ from 'lodash'

import { withStyles, WithStyles, createStyles, withTheme, WithTheme, Theme, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import AppBar from '@material-ui/core/AppBar';
import Button from '@material-ui/core/Button';
import FormHelperText from '@material-ui/core/FormHelperText';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Dialog from '@material-ui/core/Dialog';
import Tabs from '@material-ui/core/Tabs'
import Tab from '@material-ui/core/Tab'
import CircularProgress from '@material-ui/core/CircularProgress';
import expansionClosedColor from '@material-ui/core/colors/blueGrey';
import expansionOpenColor from '@material-ui/core/colors/blue';


import {Cluster, Namespace, Pod, Item, KubeComponent} from "../k8s/k8sTypes";
import * as k8s from '../k8s/k8sClient'
import Context from "./contextStore";
import SelectionTable from './selectionTable'
import {selectionDialogTheme} from '../theme/theme'
import PodFilter from './podFilter'
import TestFilter from './testFilter'

const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  root: {
    padding: spacing.unit,
    color: palette.primary.main,
  },
  loading: {
    display: 'block',
    marginTop: '40%',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
});

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
  selectedClusters: Map<string, Cluster>
  selectedNamespaces: Map<string, Namespace>
  selectedPods: Map<string, Pod>
  filter: string,
  useDarkTheme: boolean
  onSelection: (clusters: Map<string, Cluster>, namespaces: Map<string, Namespace>, 
              pods: Map<string, Pod>, filter: string) => any
  onCancel: () => any
}
interface SelectionDialogState {
  activeTab: number
  clusterInfo: Map<string, [Cluster, Map<string, [Namespace, Map<string, Pod>]>]>
  clustersInError: string[]
  namespacesInError: string[]
  reportClusterError: boolean
  reportNamespaceError: boolean
  clusters: {[group: string]: Cluster[]}
  namespaces: {[group: string]: Namespace[]}
  pods: {[group: string]: Pod[]}
  selectedClusters: Map<string, Cluster>
  selectedNamespaces: Map<string, Namespace>
  selectedPods: Map<string, Pod>,
  filter: string,
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
    clusterInfo: new Map,
    clustersInError: [],
    namespacesInError: [],
    reportClusterError: false,
    reportNamespaceError: false,
    clusters: {},
    namespaces: {},
    pods: {},
    selectedClusters: new Map,
    selectedNamespaces: new Map,
    selectedPods: new Map,
    filter: '',
  }
  refs: SelectionDialogRefs = {
    clusterSelector: undefined,
    namespaceSelector: undefined,
    podSelector: undefined,
  }
  loadTimerHandle: any
  closed: boolean = false
  clusterLoadingQueue: Set<string> = new Set
  loadingCounter: number = 0
  activeTabIndex: number = 0

  componentDidMount() {
    this.closed = false
    this.componentWillReceiveProps(this.props)
  }

  componentWillUnmount() {
    if(this.loadTimerHandle) {
      clearTimeout(this.loadTimerHandle)
    }
    this.closed = true
  }

  componentWillReceiveProps(nextProps: SelectionDialogProps) {
    const {selectedClusters, selectedNamespaces, selectedPods} = this.state

    selectedClusters.clear()
    selectedNamespaces.clear()
    selectedPods.clear()
    
    nextProps.selectedClusters.forEach(item => selectedClusters.set(item.text(), item))
    nextProps.selectedNamespaces.forEach(item => selectedNamespaces.set(item.text(), item))
    nextProps.selectedPods.forEach(item => selectedPods.set(item.text(), item))

    this.loadSelectedClustersData(selectedClusters)
    const {selection} = nextProps
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
    this.setState({selectedClusters, selectedNamespaces, selectedPods, filter: nextProps.filter})
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

  loadSelectedClustersData(selectedClusters: Map<string, Cluster>) {
    const clustersToLoad : Cluster[] = []
    selectedClusters.forEach(cluster => {
      if(!this.clusterLoadingQueue.has(cluster.text())) {
        clustersToLoad.push(cluster)
        this.clusterLoadingQueue.add(cluster.text())
      }
    })

    if(clustersToLoad.length > 0) {
      this.loadingCounter++
      Promise.all(
        clustersToLoad.map(cluster => 
          this.loadClusterData(cluster))
      )
      .then(result => {
        this.loadingCounter--
        clustersToLoad.forEach(cluster => this.clusterLoadingQueue.delete(cluster.text()))
        if(!this.closed) {
          this.removeInvalidItems()
          this.setTab(this.activeTabIndex)
        }
      })
      .catch(error => {
        this.loadingCounter--
        clustersToLoad.forEach(cluster => this.clusterLoadingQueue.delete(cluster.text()))
        console.log("[Loading %s] Loading cluster data failed for selected clusters: %s", 
            this.loadingCounter, clustersToLoad)
      })
    }
  }

  loadClusterData(cluster: Cluster) {
    return new Promise((resolve, reject) => {
      const namespaceMap : Map<string, [Namespace, Map<string, Pod>]> = new Map
      k8s.getNamespacesForCluster(cluster)
        .then(namespaces => {
          Promise.all(
            namespaces.map(ns => this.loadNamespaceData(ns, namespaceMap))
          )
          .then(result => {
            if(!this.closed) {
              const {clusterInfo} = this.state
              clusterInfo.set(cluster.text(), [cluster, namespaceMap])
              this.setState({clusterInfo})
            }
            resolve(true)
          })
          .catch(err => {
            console.log("Failed to load pods for some namespaces: " + err)
            reject(false)
          })
        })
        .catch(error => {
          if(!this.closed) {
            const {clustersInError} = this.state
            clustersInError.push(cluster.text())
            this.setState({clustersInError})
          }
          console.log("Error while loading namespaces for cluster %s: %s", cluster.text(), error)
          reject(false)
        })
    })
  }

  removeInvalidItems() {
    const {clusterInfo, selectedClusters, selectedNamespaces, selectedPods} = this.state
    selectedClusters.forEach(c => {
      if(!clusterInfo.has(c.text())) {
        selectedClusters.delete(c.text())
      }
    })
    selectedNamespaces.forEach(ns => {
      if(!selectedClusters.get(ns.cluster.text())) {
        selectedNamespaces.delete(ns.text())
      }
      const clusterRec = clusterInfo.get(ns.cluster.text())
      if(!clusterRec || !clusterRec[1].has(ns.text())) {
        selectedNamespaces.delete(ns.text())
      } else {
        const nsRec = clusterRec[1].get(ns.text())
        nsRec && selectedNamespaces.set(ns.text(), nsRec[0])
      }
    })
    selectedPods.forEach(pod => {
      if(!selectedNamespaces.get(pod.namespace.text())) {
        selectedPods.delete(pod.text())
      }
      const clusterRec = clusterInfo.get(pod.namespace.cluster.text())
      const nsRec = clusterRec && clusterRec[1].get(pod.namespace.text())
      if(!clusterRec || !nsRec) {
        selectedPods.delete(pod.text())
      } else {
        const newPod = nsRec[1].get(pod.text())
        if(!newPod) {
          selectedPods.delete(pod.text())
        } else {
          newPod && selectedPods.set(pod.text(), newPod)
        }
      }
    })

    this.setState({selectedClusters, selectedNamespaces, selectedPods})
  }

  loadNamespaceData(namespace: Namespace, 
                    namespaceMap : Map<string, [Namespace, Map<string, Pod>]>) : Promise<boolean> {
    return new Promise((resolve, reject) => {
      k8s.getPodsForNamespace(namespace)
      .then(pods => {
        const podMap : Map<string, Pod> = new Map
        pods.forEach(pod => podMap.set(pod.text(), pod))
        namespaceMap.set(namespace.text(), [namespace, podMap])
        resolve(true)
      })
      .catch(error => {
        if(!this.closed) {
          const {namespacesInError} = this.state
          namespacesInError.push(namespace.text())
          this.setState({namespacesInError})
        }
        console.log("Error while loading pods for namespace %s: %s", namespace.name, error)
        reject(false)
      })
    })
  }

  loadClusters() {
    const {clusterInfo, clusters, selectedClusters} = this.state
    const allClusters = k8s.getAllClusters()
    clusters[''] = []
    allClusters.forEach(c => {
      clusters[''].push(c)
    })
    this.setState({
      clusters,
      selectedClusters,
      namespaces: {},
      pods: {},
      activeTab: 0,
    })
  }

  loadNamespacesIntoState(state: SelectionDialogState) : SelectionDialogState {
    const {clusterInfo, clustersInError, selectedClusters, selectedNamespaces} = state
    const namespaces : {[group: string]: Namespace[]} = {}
    let reportClusterError = false

    selectedClusters.forEach(cluster => {
      if(clustersInError.includes(cluster.text())) {
        reportClusterError = true
      } else {
        const clusterRec = clusterInfo.get(cluster.text())
        if(clusterRec) {
          namespaces[cluster.text()] = Array.from(clusterRec[1].values())
              .map(rec => rec[0]).sort((n1,n2) => n1.name.localeCompare(n2.name))
        } else {
          namespaces[cluster.text()] = []
        }
      }
    })
    Object.assign(state, {
      namespaces, 
      selectedNamespaces, 
      reportClusterError,
      pods: {}, 
    })
    return state
  }

  loadNamespaces() {
    this.setState(this.loadNamespacesIntoState.bind(this))
  }

  loadPodsIntoState(allNamespaces: boolean, state: SelectionDialogState) : SelectionDialogState {
    let reportNamespaceError = false
    const {clusterInfo, clustersInError, namespacesInError, namespaces, selectedNamespaces, selectedPods} = state
    const pods : {[group: string]: Pod[]} = {}
    const namespacesToLoad : Namespace[] = allNamespaces ? 
            _.flatten(_.values(namespaces))
            : 
            Array.from(selectedNamespaces.values())
    namespacesToLoad.forEach(namespace => {
      const cluster = namespace.cluster
      if(clustersInError.includes(cluster.text()) ||
        namespacesInError.includes(namespace.text())) {
        reportNamespaceError = true
      } else {
        const clusterRec = clusterInfo.get(cluster.text())
        const nsRec = clusterRec && clusterRec[1].get(namespace.text())
        if(nsRec) {
          pods[namespace.text()] = Array.from(nsRec[1].values())
                              .sort((p1,p2) => p1.name.localeCompare(p2.name))
        } else {
          pods[namespace.text()] = []
        }
      }
    })
    Object.assign(state, {
      pods, 
      selectedPods,
      reportNamespaceError,
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
      state = this.loadPodsIntoState(true, state)
      const {reportNamespaceError, selectedPods, pods} = state
      if(reportNamespaceError) {
        return state
      }
      return state
    })
  }

  delayedLoadClusterData(selectedClusters: Map<string, Cluster>) {
    if(this.loadTimerHandle) {
      clearTimeout(this.loadTimerHandle)
    }
    this.loadTimerHandle = setTimeout(this.loadSelectedClustersData.bind(this, selectedClusters), 300)
  }

  onSelectComponent(selectionStore: SelectionStore, item: KubeComponent) {
    const selectedItems: Map<string, KubeComponent> = this.state[selectionStore]
    const selected : boolean = !selectedItems.has(item.text())
    if(selected) {
      selectedItems.set(item.text(), item)
    } else {
      selectedItems.delete(item.text())
    }
    if(selectionStore === SelectionStore.selectedClusters) {
      this.delayedLoadClusterData(selectedItems as Map<string, Cluster>)
    }
    this.setState(state => {
      state[selectionStore.toString()] = selectedItems
      return state
    })
  }

  onApplyFilter = (filter: string, pods: Pod[]) => {
    const {selectedNamespaces, selectedPods} = this.state
    selectedNamespaces.clear()
    selectedPods.clear()
    pods.forEach(pod => {
      selectedNamespaces.set(pod.namespace.text(), pod.namespace)
      selectedPods.set(pod.text(), pod)
    })
    this.setState({
      filter,
      selectedNamespaces,
      selectedPods
    })
  }

  handleEntering() {
  };

  handleCancel() {
    this.props.onCancel()
  };

  handleOk() {
    const {selectedClusters, selectedNamespaces, selectedPods, filter} = this.state
    this.props.onSelection(selectedClusters, selectedNamespaces, selectedPods, filter)
  };

  render() {
    const { classes, open, forced, useDarkTheme } = this.props;
    const { activeTab, 
      reportClusterError, clustersInError,
      reportNamespaceError, namespacesInError,
      clusters, selectedClusters, 
      namespaces, selectedNamespaces, 
      pods, selectedPods, filter,
    } = this.state
    const loading = this.loadingCounter > 0

    const theme = createMuiTheme(selectionDialogTheme.getTheme(useDarkTheme));
    
    return (
      <MuiThemeProvider theme={theme}>
        <Dialog
          onEntering={this.handleEntering}
          aria-labelledby="confirmation-dialog-title"
          onClose={this.handleCancel.bind(this)}
          open={open}
        >
          <DialogContent>
            <AppBar position="static">
              <Tabs value={activeTab}
                  onChange={this.onTabChange.bind(this)} >
                <Tab label="Clusters" />
                <Tab label="Select by Pattern" disabled={selectedClusters.size === 0} />
                <Tab label="Namespaces" disabled={selectedClusters.size === 0} />
                <Tab label="Pods" disabled={selectedNamespaces.size === 0} />
              </Tabs>
            </AppBar>  
            {activeTab === SelectionTabs.Clusters &&  
              <div>
                <SelectionTable 
                    innerRef={this.refs.clusterSelector}
                    title="Clusters" 
                    table={clusters}
                    selections={selectedClusters}
                    grouped={false}
                    maxSelect={2}
                    onSelection={this.onSelectComponent.bind(this, SelectionStore.selectedClusters)}
                />
              </div>}
            {loading && activeTab !== SelectionTabs.Clusters && <CircularProgress className={classes.loading} />}
            {!loading && activeTab === SelectionTabs.Pattern &&
              <PodFilter pods={pods} filter={filter}
                onApplyFilter={this.onApplyFilter}
              />
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
                    maxSelect={2}
                    onSelection={this.onSelectComponent.bind(this, SelectionStore.selectedNamespaces)}
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
          <DialogActions>
            <Button onClick={this.handleCancel.bind(this)} >
              Cancel
            </Button>
            <Button onClick={this.handleOk.bind(this)}>
              Ok
            </Button>
          </DialogActions>
        </Dialog>
      </MuiThemeProvider>  
    );
  }
}

export default withStyles(styles)(SelectionDialog);
