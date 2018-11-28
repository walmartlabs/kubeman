import React from 'react';
import _ from 'lodash'
import { isNullOrUndefined } from 'util';

import { withStyles, WithStyles, createStyles, withTheme, WithTheme, Theme, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormHelperText from '@material-ui/core/FormHelperText';
import Checkbox from '@material-ui/core/Checkbox';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Typography from '@material-ui/core/Typography';

import {Cluster, Namespace, Pod, Item, KubeComponent} from "../k8s/k8sTypes";


const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  root: {
    padding: spacing.unit,
    color: palette.primary.main,
  },
  formControl: {
    margin: spacing.unit * 0.9,
    padding: spacing.unit * 0.7,
  },
  table: {
    minWidth: 400,
  },
  tableCell: {
    margin: 0,
    padding: 0,
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
})

interface ItemsListProps extends WithStyles<typeof styles> {
  title: string
  list: KubeComponent[]
  newSelections: Map<string, KubeComponent>
  disbleSelection: boolean
  handleChange: (KubeComponent) => any
}
const ItemsList = ({title, classes, list, newSelections, handleChange, disbleSelection} : ItemsListProps) => {
  return (list.length === 0 ?
    <FormHelperText>No {title} found</FormHelperText>
    :  
    <Table className={classes.table} aria-labelledby="tableTitle">
      <TableBody>
      {list.map((item, index) => 
        <TableRow key={index} hover>
          <TableCell className={classes.tableCell}>
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
  )
}

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

class SelectionTable extends React.Component<SelectionTableProps, SelectionTableState> {
  static defaultProps = {
    maxSelect: -1
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
    } else if(maxSelect > 0 && countSelected < maxSelect) {
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
    const hasData = _.flatten(_.values(table)).length > 0
    const disbleSelection = maxSelect > 0 && countSelected >= maxSelect

    if(!hasData) {
      return <FormHelperText>No {title} found</FormHelperText>
    } else {
      return (
        <div>
          {maxSelect > 0 && 
          <FormHelperText>Select up to {maxSelect} {title}</FormHelperText>}
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
                  <ItemsList  title={title} 
                              classes={classes} 
                              newSelections={newSelections}
                              list={list} 
                              disbleSelection={disbleSelection}
                              handleChange={this.handleChange} />
                </ExpansionPanelDetails>
              </ExpansionPanel>
              )
            })
            :
            <ItemsList  title={title} 
                        classes={classes} 
                        newSelections={newSelections}
                        list={table[groups[0]]} 
                        disbleSelection={disbleSelection}
                        handleChange={this.handleChange} />
          }
        </div>
      )
    }
  }
}

export default withStyles(styles)(SelectionTable);
