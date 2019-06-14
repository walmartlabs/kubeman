/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import React, { ChangeEvent } from 'react';
import _ from 'lodash'
import { isNullOrUndefined } from 'util';
import { withStyles, WithStyles } from '@material-ui/core/styles'
import { FormControlLabel, FormHelperText, Checkbox, Typography, Input } from '@material-ui/core';
import { Table, TableBody, TableCell, TableRow } from '@material-ui/core';
import { ExpansionPanel, ExpansionPanelSummary, ExpansionPanelDetails } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import {KubeComponent} from "../k8s/k8sObjectTypes";
import {filter} from '../util/filterUtil'

import styles from './selectionTable.styles'


interface ItemsListProps extends WithStyles<typeof styles> {
  title: string
  list: KubeComponent[]
  newSelections: Map<string, KubeComponent>
  disbleSelection: boolean
  handleChange: (KubeComponent) => any
}

const JumpingItemsList = ({title, classes, list, newSelections, handleChange, disbleSelection} : ItemsListProps) => {
  const selectedList = list.filter(item => !isNullOrUndefined(newSelections.get(item.text())))
  const unselectedList = list.filter(item => isNullOrUndefined(newSelections.get(item.text())))
  return (list.length === 0 ?
    <FormHelperText>No {title} found</FormHelperText>
    :  
    <Table className={classes.table} aria-labelledby="tableTitle">
      <TableBody>
        {selectedList.map((item, index) => (
              <TableRow key={index} hover>
                <TableCell className={classes.tableCell}>
                  <FormControlLabel
                    control={
                      <Checkbox checked={true} 
                                value={item.text()}
                                onChange={() => handleChange(item)} />
                    }
                    label={item.name}
                  />
                </TableCell>
              </TableRow>
        ))}
        {unselectedList.map((item, index) => (
            <TableRow key={index} hover>
              <TableCell className={classes.tableCell}>
                <FormControlLabel
                  control={
                    <Checkbox checked={false} 
                              value={item.text()}
                              disabled={disbleSelection}
                              indeterminate={disbleSelection}
                              onChange={() => handleChange(item)} />
                  }
                  label={item.name}
                />
              </TableCell>
            </TableRow>
        ))}
      </TableBody>
    </Table>  
  )
}


const ItemsList = ({title, classes, list, newSelections, handleChange, disbleSelection} : ItemsListProps) => {
  return (list.length === 0 ?
    <FormHelperText>No {title} found</FormHelperText>
    :  
    <Table className={classes.table} aria-labelledby="tableTitle">
      <TableBody>
      {list.map((item, index) => {
        const selected = !isNullOrUndefined(newSelections.get(item.text()))
        return (
          <TableRow key={index} hover>
            <TableCell className={classes.tableCell}>
              <FormControlLabel
                control={
                  <Checkbox checked={selected} 
                            value={item.text()}
                            disabled={!selected && disbleSelection}
                            indeterminate={!selected && disbleSelection}
                            onChange={() => handleChange(item)} />
                }
                label={item.name}
              />
            </TableCell>
          </TableRow>
        )
      })
      }
      </TableBody>
    </Table>  
  )
}

const getGroupedItemsList = (title, group, classes, list, newSelections, selectedCount, disbleSelection, handleChange) => (
  [
    <ExpansionPanelSummary key="1" expandIcon={<ExpandMoreIcon />}>
      <Typography className={classes.heading}>{group}</Typography>
      <Typography className={classes.secondaryHeading}>({list.length} items, {selectedCount} selected)</Typography>
    </ExpansionPanelSummary>,
    <ExpansionPanelDetails key="2">
      <ItemsList  title={title} 
                  classes={classes} 
                  newSelections={newSelections}
                  list={list} 
                  disbleSelection={disbleSelection}
                  handleChange={handleChange} />
    </ExpansionPanelDetails>
  ]
)

const CollapsedGroupedItemsList = ({title, group, classes, list, newSelections, selectedCount, disbleSelection, handleChange}) => (
  <ExpansionPanel defaultExpanded={false}>
    {...getGroupedItemsList(title, group, classes, list, newSelections, selectedCount, disbleSelection, handleChange)}
  </ExpansionPanel>
)

const ExpandedGroupedItemsList = ({title, group, classes, list, newSelections, selectedCount, disbleSelection, handleChange}) => (
  <ExpansionPanel defaultExpanded={true}>
    {...getGroupedItemsList(title, group, classes, list, newSelections, selectedCount, disbleSelection, handleChange)}
  </ExpansionPanel>
)


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
  filteredTable: {[group: string]: KubeComponent[]}
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
    filteredTable: {},
    newSelections: new Map(),
    collapsedGroups: {},
    countSelected: 0,
  }
  filterText: string = ''

  componentDidMount() {
    this.handleChange = this.handleChange.bind(this)
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(nextProps: SelectionTableProps) {
    const {table, selections} = nextProps
    const newSelections = new Map();
    Array.from(selections.values()).forEach(item => newSelections.set(item.text(), item))
    this.setState({
      newSelections: newSelections, 
      countSelected: selections.size, 
      table,
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

  onFilterChange = (event) => {
    const {table, newSelections} = this.state
    const filteredTable = {}
    let text = event.target.value
    if(text && text.length > 0) {
      this.filterText = text
      if(text.length > 0) {
        Object.keys(table).forEach(group => {
          const list = table[group]
          let filteredList = filter(text, list, "name")
          list.filter(item => !isNullOrUndefined(newSelections.get(item.text())))
              .forEach(item => {
                if(filteredList.includes(item)) {
                  filteredList = filteredList.filter(i => i !== item)
                }
                filteredList.unshift(item)
              })
          filteredTable[group] = filteredList
        })
        this.setState({filteredTable})
      }
    } else {
      this.clearFilter()
    }
    this.forceUpdate()
  }

  clearFilter() {
    this.filterText = ''
    this.setState({filteredTable: {}})
  }

  onKeyDown = (event) => {
    if(event.which === 27 /*Esc*/) {
      this.clearFilter()
    }
  }

  render() {
    const {filteredTable, table, newSelections, countSelected, collapsedGroups} = this.state;
    const {title, classes, maxSelect, grouped} = this.props;
    const isFiltered = Object.keys(filteredTable).length > 0
    const dataTable = isFiltered ? filteredTable : table

    const groups = Object.keys(dataTable)
    const hasData = _.flatten(_.values(dataTable)).length > 0
    const disbleSelection = maxSelect > 0 && countSelected >= maxSelect

    let heading = ''
    if(hasData) {
      if(maxSelect > 0) {
        heading = "Select up to " + maxSelect + " " + title + " "
      } else {
        heading = "Select " + title + " "
      }
      let totalItems = 0
      Object.values(dataTable).forEach(list => totalItems += list.length)
      heading += "(" + totalItems + " items, " + newSelections.size + " selected)"
    }

    return (
      <div>
        <Input fullWidth autoFocus
                placeholder="Type here to search" 
                value={this.filterText}
                onChange={this.onFilterChange}
                onKeyDown={this.onKeyDown}
                className={classes.filterInput}
        />
        {!hasData && <FormHelperText>No {title} found</FormHelperText>}
        {hasData && <FormHelperText>{heading}</FormHelperText>}
        {hasData && grouped && 
            groups.map((group, index) => {
              const list = dataTable[group]
              const selectedCount = list.filter(item => !isNullOrUndefined(newSelections.get(item.text()))).length
              return (
                isFiltered || groups.length===1 ? 
                <ExpandedGroupedItemsList 
                    key={index}
                    title={title}
                    group={group}
                    classes={classes} 
                    list={list} 
                    newSelections={newSelections}
                    selectedCount={selectedCount}
                    disbleSelection={disbleSelection}
                    handleChange={this.handleChange}
                />
                :
                <CollapsedGroupedItemsList 
                    key={index}
                    title={title}
                    group={group}
                    classes={classes} 
                    list={list} 
                    newSelections={newSelections}
                    selectedCount={selectedCount}
                    disbleSelection={disbleSelection}
                    handleChange={this.handleChange}
                />
              )
            })
        }
        {hasData && !grouped && 
            <ItemsList  title={title} 
                        classes={classes} 
                        newSelections={newSelections}
                        list={dataTable[groups[0]]} 
                        disbleSelection={disbleSelection}
                        handleChange={this.handleChange} />
        }
      </div>
    )
  }
}

export default withStyles(styles)(SelectionTable);
