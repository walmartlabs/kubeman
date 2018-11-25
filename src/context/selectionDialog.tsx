import React from 'react';
import _ from 'lodash'
import { isNullOrUndefined } from 'util';

import { withStyles, WithStyles, createStyles, withTheme, WithTheme, Theme, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import AppBar from '@material-ui/core/AppBar';
import Button from '@material-ui/core/Button';
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormHelperText from '@material-ui/core/FormHelperText';
import Checkbox from '@material-ui/core/Checkbox';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Dialog from '@material-ui/core/Dialog';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import Tabs from '@material-ui/core/Tabs'
import Tab from '@material-ui/core/Tab'
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';
import expansionClosedColor from '@material-ui/core/colors/blueGrey';
import expansionOpenColor from '@material-ui/core/colors/blue';


import {Cluster, Namespace, Pod, Item, KubeComponent} from "../k8s/k8sTypes";
import * as k8s from '../k8s/k8sClient'
import Context from "./contextStore";


const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  root: {
    padding: spacing.unit,
    color: palette.primary.main,
  },
  formControl: {
    margin: spacing.unit * 3,
  },
  table: {
    minWidth: 400,
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  heading: {
    fontSize: typography.pxToRem(15),
    fontWeight: typography.fontWeightRegular,
  },
  secondaryHeading: {
    fontSize: typography.pxToRem(12),
    color: palette.text.secondary,
    marginLeft: 10,
    marginTop: 2,
  },
  loading: {
    display: 'block',
    marginTop: '40%',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
});

interface ItemsListProps extends WithStyles<typeof styles> {
  list: KubeComponent[]
  newSelections: Map<string, KubeComponent>
  disbleSelection: boolean
  handleChange: (KubeComponent) => any
}
const ItemsList = ({classes, list, newSelections, handleChange, disbleSelection} : ItemsListProps) =>
    <Table className={classes.table} aria-labelledby="tableTitle">
      <TableBody>
      {list.map((item, index) => 
        <TableRow key={index} hover>
          <TableCell>
            <FormControlLabel
              control={
                <Checkbox checked={!isNullOrUndefined(newSelections.get(item.text()))} 
                          value={item.text()}
                          disabled={isNullOrUndefined(newSelections.get(item.text())) && disbleSelection}
                          indeterminate={isNullOrUndefined(newSelections.get(item.text())) && disbleSelection}
                          onChange={() => handleChange(item)} />
              }
              label={item.name}
            />
          </TableCell>
        </TableRow>
      )}
      </TableBody>
    </Table>  


interface SelectionTableProps extends WithStyles<typeof styles> {
  table: {[group: string]: KubeComponent[]}
  selections: Map<string, KubeComponent>
  title: string
  maxSelect: number
  grouped: boolean
  onSelection: (KubeComponent) => void
}

interface SelectionTableState {
  table: {[group: string]: KubeComponent[]}
  newSelections: Map<string, KubeComponent>
  collapsedGroups: {}
  countSelected: number,
}

const SelectionTable = withStyles(styles)(
  class extends React.Component<SelectionTableProps, SelectionTableState> {
    static defaultProps = {
      maxSelect: 2
    }

    state: SelectionTableState = {
      table: {},
      newSelections: new Map(),
      collapsedGroups: {},
      countSelected: 0,
    }

    componentDidMount() {
      this.handleChange = this.handleChange.bind(this)
      this.componentWillReceiveProps(this.props)
    }

    componentWillReceiveProps(nextProps: SelectionTableProps) {
      const {title, table, selections} = nextProps
      const newSelections = new Map();
      Array.from(selections.values()).forEach(item => newSelections.set(item.text(), item))
      this.setState({
        newSelections: newSelections, 
        countSelected: selections.size, 
        table
      })
    }

    getSelections() : Array<KubeComponent> {
      const {newSelections} = this.state
      return Array.from(newSelections.values())
    }

    handleChange(item: KubeComponent) {
      const {newSelections} = this.state;
      const {maxSelect, onSelection} = this.props
      let countSelected : number = newSelections.size

      const exists = newSelections.get(item.text())
      if(exists) {
        newSelections.delete(item.text())
        countSelected--
      } else if(countSelected < maxSelect) {
        newSelections.set(item.text(), item)
        countSelected++
      }
      this.setState({newSelections, countSelected});
      onSelection(item)
    };

    handleCollapse(group: string) {
      const {collapsedGroups} = this.state
      collapsedGroups[group] = !collapsedGroups[group]
      this.setState({collapsedGroups});
    }

    render() {
      const {table, newSelections, countSelected, collapsedGroups} = this.state;
      const {title, classes, maxSelect, grouped} = this.props;
      const groups = Object.keys(table)
      const hasData = groups && groups.length > 0 && table[groups[0]] && table[groups[0]].length > 0
      const disbleSelection=countSelected >= maxSelect

      if(!hasData) {
        return <FormHelperText>No {title} found</FormHelperText>
      } else {
        return (
          <div>
            <FormHelperText>Select up to 2 {title}</FormHelperText>
            {
            grouped ? 
              groups.map((group, index) => {
                const list = table[group]
                const tableSelected = list.filter(item => !isNullOrUndefined(newSelections.get(item.text()))).length
                return (
                <ExpansionPanel key={index} defaultExpanded={groups.length===1}>
                  <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography className={classes.heading}>{group}</Typography>
                    <Typography className={classes.secondaryHeading}>({list.length} items, {tableSelected} selected)</Typography>
                  </ExpansionPanelSummary>
                  <ExpansionPanelDetails>
                    <ItemsList classes={classes} 
                                  newSelections={newSelections}
                                  list={list} 
                                  disbleSelection={disbleSelection}
                                  handleChange={this.handleChange} />
                  </ExpansionPanelDetails>
                </ExpansionPanel>
                )
              })
              :
                <Table className={classes.table} aria-labelledby="tableTitle">
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <ItemsList classes={classes} 
                                  newSelections={newSelections}
                                  list={table[groups[0]]} 
                                  disbleSelection={disbleSelection}
                                  handleChange={this.handleChange} />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>  
            }
          </div>
        )
      }
    }
  }
)


export enum SelectionType {
  Clusters = "Clusters",
  Namespaces = "Namespaces",
  Pods = "Pods",
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
  useDarkTheme: boolean
  onSelection: (clusters: Map<string, Cluster>, namespaces: Map<string, Namespace>, pods: Map<string, Pod>) => any
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
  selectedPods: Map<string, Pod>
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
      this.setTab(0)
        break
      case SelectionType.Namespaces:
        this.setTab(1)
        break
      case SelectionType.Pods:
        this.setTab(2)
        break
  }
    this.setState({selectedClusters, selectedNamespaces, selectedPods})
  }

  onTabChange(event, tabIndex) {
    this.setTab(tabIndex)
  }

  setTab(tabIndex: number) {
    switch(tabIndex) {
      case 0:
        this.loadClusters()
        break
      case 1:
        this.loadNamespaces()
        break
      case 2:  
        this.loadPods()
        break
    }
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
          this.loadNamespaces()
          this.loadPods()
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
            const {clusterInfo} = this.state
            clusterInfo.set(cluster.text(), [cluster, namespaceMap])
            this.setState({clusterInfo})
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
    selectedClusters.forEach(c => {
      if(!clusterInfo.has(c.text())) {
        selectedClusters.delete(c.text())
      }
    })
    this.setState({
      clusters,
      selectedClusters,
      namespaces: {},
      pods: {},
      activeTab: 0,
    })
  }

  loadNamespaces() {
    this.setState((state) => {
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

      Object.assign(state, {
        namespaces, 
        selectedNamespaces, 
        reportClusterError,
        pods: {}, 
      })
      return state
    })
  }

  loadPods() {
    this.setState((state) => {
      let reportNamespaceError = false
      const {clusterInfo, clustersInError, namespacesInError, selectedNamespaces, selectedPods} = state
      const pods : {[group: string]: Pod[]} = {}
      selectedNamespaces.forEach(namespace => {
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
      const podNames = _.flatten(_.values(pods)).map(pod => pod.text())
      selectedPods.forEach(pod => {
        if(!selectedNamespaces.get(pod.namespace.text())) {
          selectedPods.delete(pod.text())
        }
        const clusterRec = clusterInfo.get(pod.namespace.cluster.text())
        const nsRec = clusterRec && clusterRec[1].get(pod.namespace.text())
        if(!clusterRec || !nsRec) {
          selectedPods.delete(pod.text())
        } else if(!podNames.includes(pod.text())) {
          selectedPods.delete(pod.text())
        } else {
          const newPod = nsRec[1].get(pod.text())
          newPod && selectedPods.set(pod.text(), newPod)
        }
      })
      Object.assign(state, {
        pods, 
        selectedPods,
        reportNamespaceError,
      })
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

  handleEntering() {
  };

  handleCancel() {
    this.props.onCancel()
  };

  handleOk() {
    const {selectedClusters, selectedNamespaces, selectedPods} = this.state
    this.props.onSelection(selectedClusters, selectedNamespaces, selectedPods)
  };

  render() {
    const { classes, open, forced, useDarkTheme } = this.props;
    const { activeTab, 
      reportClusterError, clustersInError,
      reportNamespaceError, namespacesInError,
      clusters, selectedClusters, 
      namespaces, selectedNamespaces, 
      pods, selectedPods,
    } = this.state
    const loading = this.loadingCounter > 0


    const theme = createMuiTheme({
      palette: {
        type: useDarkTheme?'dark':'light'
      },
      overrides: {
        MuiDialog: {
          paper: {
            height: '80vh',
            minHeight: '80vh',
            maxHeight: '80vh',
            width: '60vh',
            minWidth: '60vh',
            maxWidth: '60vh',
          }
        },
        MuiTabs: {
          indicator: {
            borderBottom: '3px solid #1890ff',
            backgroundColor: '#1890ff',
          },
        },
        MuiExpansionPanelSummary: {
          root: {
            backgroundColor: expansionClosedColor[useDarkTheme ? 800 : 200],
            height: 64,
            marginTop: 17,
          },
          expanded: {
            backgroundColor: expansionOpenColor[useDarkTheme ? 800 : 200],
          }
        }
      }
    });
    
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
                <Tab label="Namespaces" disabled={selectedClusters.size === 0} />
                <Tab label="Pods" disabled={selectedNamespaces.size === 0} />
              </Tabs>
            </AppBar>  
            {activeTab === 0 &&  
              <div>
                <SelectionTable 
                    innerRef={this.refs.clusterSelector}
                    title="Clusters" 
                    table={clusters}
                    selections={selectedClusters}
                    grouped={false}
                    onSelection={this.onSelectComponent.bind(this, SelectionStore.selectedClusters)}
                />
              </div>}
            {loading && activeTab !== 0 && <CircularProgress className={classes.loading} />}
            {!loading && activeTab === 1 &&  
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
                    onSelection={this.onSelectComponent.bind(this, SelectionStore.selectedNamespaces)}
                />
                }
              </div>}
            {!loading && activeTab === 2 &&  
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
