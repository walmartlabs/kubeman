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
  expansionHead: {
    fontSize: typography.pxToRem(15),
    fontWeight: typography.fontWeightRegular,
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
  <FormControl component="fieldset" className={classes.formControl}>
    <FormGroup>
      <Table className={classes.table} aria-labelledby="tableTitle">
        <TableBody>
        {list.map((item, index) => 
          <TableRow key={index} hover>
            <TableCell>
              <FormControlLabel
                control={
                  <Checkbox checked={!isNullOrUndefined(newSelections.get(item.text()))} 
                            value={item.text()}
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
    </FormGroup>
  </FormControl>


interface SelectionTableProps extends WithStyles<typeof styles> {
  table: {[group: string]: KubeComponent[]}
  selections: Map<string, KubeComponent>
  title: string
  maxSelect: number,
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
      const { title, classes, maxSelect } = this.props;
      const groups = Object.keys(table)
      const hasData = groups && groups.length > 0 && table[groups[0]] && table[groups[0]].length > 0
      const openFirst = groups && groups.length == 1
      const disbleSelection=countSelected >= maxSelect


      if(!hasData) {
        return <FormHelperText>No {title} found</FormHelperText>
      } else {
        return (
          <div>
            <FormHelperText>Select up to 2 {title}</FormHelperText>
            {
            groups.map((group, index) =>
              openFirst ? 
              <Table key={index} className={classes.table} aria-labelledby="tableTitle">
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <ItemsList classes={classes} 
                                newSelections={newSelections}
                                list={table[group]} 
                                disbleSelection={disbleSelection}
                                handleChange={this.handleChange} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>  
              :
              <ExpansionPanel key={index}>
                <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography className={classes.expansionHead}>{group}</Typography>
                </ExpansionPanelSummary>
                <ExpansionPanelDetails>
                  <ItemsList classes={classes} 
                                newSelections={newSelections}
                                list={table[group]} 
                                disbleSelection={disbleSelection}
                                handleChange={this.handleChange} />
                </ExpansionPanelDetails>
              </ExpansionPanel>
            )}
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
  clusterInfo: Map<string, [Cluster, Map<string, [Namespace, Pod[]]>]>
  clusters: {[group: string]: Cluster[]}
  namespaces: {[group: string]: Namespace[]}
  pods: {[group: string]: Pod[]}
  selectedClusters: Map<string, Cluster>
  selectedNamespaces: Map<string, Namespace>
  selectedPods: Map<string, Pod>
  loading: boolean,
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
    clusters: {},
    namespaces: {},
    pods: {},
    selectedClusters: new Map,
    selectedNamespaces: new Map,
    selectedPods: new Map,
    loading: true,
  }
  refs: SelectionDialogRefs = {
    clusterSelector: undefined,
    namespaceSelector: undefined,
    podSelector: undefined,
  }
  loadTimerHandle: any

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(nextProps: SelectionDialogProps) {
    const {selectedClusters, selectedNamespaces, selectedPods} = this.state

    selectedClusters.clear()
    selectedNamespaces.clear()
    selectedPods.clear()
    
    nextProps.selectedClusters.forEach(item => selectedClusters.set(item.text(), item))
    nextProps.selectedNamespaces.forEach(item => selectedNamespaces.set(item.text(), item))
    nextProps.selectedPods.forEach(item => selectedPods.set(item.text(), item))

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

  loadClusterData(selectedClusters: Map<string, Cluster>) {
    const {clusterInfo} = this.state
    console.log("loadClusterData: started loading for " + Array.from(selectedClusters.values()))
    this.setState({loading: true})
    selectedClusters.forEach(c => {
      const namespaceMap : Map<string, [Namespace, Pod[]]> = new Map
      clusterInfo.set(c.text(), [c, namespaceMap])
      k8s.getNamespacesForCluster(c)
        .then(namespaces => {
          namespaces.forEach(ns => 
            k8s.getPodsForNamespace(ns)
            .then(pods => {
              console.log("loadClusterData: finished loading for " + Array.from(selectedClusters.values()))
              namespaceMap.set(ns.text(), [ns, pods.sort((p1,p2) => p1.name.localeCompare(p2.name))])
              this.setState({clusterInfo, loading: false})
              this.loadNamespaces()
              this.loadPods()
            })
            .catch(error => {
              console.log("Error while loading pods: " + error)
              this.setState({clusterInfo, loading: false})
            }))
        })
        .catch(error => {
          console.log("Error while loading namespaces: " + error)
          this.setState({clusterInfo, loading: false})
        })
    })
  }

  loadClusters() {
    const {clusterInfo, clusters, selectedClusters} = this.state
    const allClusters = k8s.getAllClusters()
    clusters[''] = []
    allClusters.forEach(c => {
      clusterInfo.set(c.text(), [c, new Map])
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
      const {clusterInfo, selectedClusters, selectedNamespaces} = state
      const clusterNamespaces : {[group: string]: Namespace[]} = {}
      selectedClusters.forEach(cluster => {
        const clusterRec = clusterInfo.get(cluster.text())
        if(clusterRec) {
          clusterNamespaces[cluster.text()] = Array.from(clusterRec[1].values())
              .map(rec => rec[0]).sort((c1,c2) => c1.name.localeCompare(c2.name))
        } else {
          clusterNamespaces[cluster.text()] = []
        }
      })
      selectedNamespaces.forEach(ns => {
        if(!selectedClusters.get(ns.cluster.text())) {
          selectedNamespaces.delete(ns.text())
        }
        const clusterRec = clusterInfo.get(ns.cluster.text())
        if(!clusterRec || !clusterRec[1].has(ns.text())) {
          selectedNamespaces.delete(ns.text())
        }
      })
      Object.assign(state, {
        namespaces: clusterNamespaces, 
        selectedNamespaces, 
        pods: {}, 
      })
      return state
    })
  }

  loadPods() {
    this.setState((state) => {
      const {clusterInfo, selectedNamespaces, selectedPods} = state
      const pods : {[group: string]: Pod[]} = {}
      selectedNamespaces.forEach(namespace => {
        const clusterRec = clusterInfo.get(namespace.cluster.text())
        const nsRec = clusterRec && clusterRec[1].get(namespace.text())
        if(nsRec) {
          pods[namespace.text()] = nsRec[1]
        } else {
          pods[namespace.text()] = []
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
        }
      })
      Object.assign(state, {
        pods, 
        selectedPods, 
      })
      return state
    })
  }

  delayedLoadClusterData(selectedClusters: Map<string, Cluster>) {
    if(this.loadTimerHandle) {
      clearTimeout(this.loadTimerHandle)
    }
    this.loadTimerHandle = setTimeout(this.loadClusterData.bind(this, selectedClusters), 1000)
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
      this.setState({loading: true})
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
    const { activeTab, loading,
      clusters, selectedClusters,
      namespaces, selectedNamespaces,
      pods, selectedPods
    } = this.state



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
                    onSelection={this.onSelectComponent.bind(this, SelectionStore.selectedClusters)}
                />
              </div>}
            {loading && activeTab !== 0 && <CircularProgress className={classes.loading} />}
            {!loading && activeTab === 1 &&  
              <div>
                <SelectionTable 
                    innerRef={this.refs.namespaceSelector}
                    title="Namespaces" 
                    table={namespaces}
                    selections={selectedNamespaces}
                    onSelection={this.onSelectComponent.bind(this, SelectionStore.selectedNamespaces)}
                />
              </div>}
            {!loading && activeTab === 2 &&  
              <div>
                <SelectionTable 
                    innerRef={this.refs.podSelector}
                    title="Pods" 
                    table={pods}
                    selections={selectedPods}
                    onSelection={this.onSelectComponent.bind(this, SelectionStore.selectedPods)}
                />
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
