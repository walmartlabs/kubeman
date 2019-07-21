/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import React, { ChangeEvent } from 'react';

import { withStyles, WithStyles} from '@material-ui/core/styles'
import { Button, Input, FormControlLabel, Checkbox, Typography, 
        ExpansionPanel, ExpansionPanelSummary, ExpansionPanelDetails,
        Dialog, DialogTitle, DialogContent, DialogActions,
        Table, TableBody, TableCell, TableRow, List, ListItem, ListItemText, ListItemIcon } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';

import {Choice} from './actionSpec'
import styles from './actionChoiceDialog.styles'
import {filter} from '../util/filterUtil'


interface IProps extends WithStyles<typeof styles> {
  open: boolean
  title: string
  choices: Choice[]
  minChoices: number
  maxChoices: number
  showChoiceSubItems: boolean
  previousSelections: Choice[]
  onSelection: (selections: any[]) => void
  onRefresh: () => any
  onCancel: () => any
}

interface IState {
  selections: Map<any, any>
  choiceItems: any[][]
  choiceDataMap: Map<any, any>
  filteredChoices: any[][]
  allSelected: boolean
}

class ActionChoiceDialog extends React.Component<IProps, IState> {
  static defaultProps = {
    open: false,
  }
  state: IState = {
    selections: new Map,
    choiceDataMap: new Map,
    choiceItems: [],
    filteredChoices: [],
    allSelected: false,
  }
  filterTimer: any = undefined

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
    const {choices} = props
    let choiceItems = choices.map(c => c.displayItem)
    let choiceDataMap = new Map
    choices.forEach(c => {
      const choiceId = c.displayItem.join(".")
      choiceDataMap.set(choiceId, c)
    })
    this.setState({choiceDataMap, choiceItems, filteredChoices: choiceItems})
  }

  onChange = (itemId: any) => {
    const {selections, choiceDataMap} = this.state
    if(selections.has(itemId)) {
      selections.delete(itemId)
    } else {
      selections.set(itemId, choiceDataMap.get(itemId))
    }
    this.setState({selections})
  }

  filter = (filterText: string) => {
    const {choiceItems} = this.state
    this.setState({filteredChoices: filter(filterText, choiceItems)})
  }

  onFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    if(this.filterTimer) {
      clearTimeout(this.filterTimer)
    }
    const text = event.target.value
    if(text.length === 0) {
      const {choiceItems} = this.state
      this.setState({filteredChoices: choiceItems})
    } else {
      this.filterTimer = setTimeout(this.filter.bind(this, text), 400)
    }
  }

  onUsePreviousSelections = () => {
    const {maxChoices, previousSelections} = this.props
    this.props.onSelection(previousSelections.slice(0, maxChoices))
  }

  onSelectAll = () => {
    let {selections, filteredChoices, choiceDataMap, allSelected} = this.state
    const {minChoices, maxChoices} = this.props
    if(allSelected) {
      selections.forEach((data, id) => selections.delete(id))
      allSelected = false
    } else {
      allSelected = true
      const countSelected = selections.size
      let maxToSelect = maxChoices > 0 ? maxChoices - countSelected : filteredChoices.length
      if(maxToSelect > 0) {
        filteredChoices.forEach(item => {
          if(maxToSelect > 0) {
            const itemId = item.join(".")
            if(!selections.has(itemId)) {
              selections.set(itemId, choiceDataMap.get(itemId))
              --maxToSelect
            }
          }
        })
      }
    }
    this.setState({selections, allSelected})
  }

  onClearSelections = () => {
    const {selections} = this.state
    selections.forEach((data, id) => selections.delete(id))
    this.setState({selections, allSelected: false})
  }

  onOk = () => {
    const {selections} = this.state
    this.props.onSelection(Array.from(selections.values()))
  }

  onKeyDown = (event) => {
    if(event.which === 27 /*Esc*/) {
      this.props.onCancel()
    }
  }

  render() {
    const {classes, open, title, minChoices, maxChoices, 
          showChoiceSubItems, previousSelections,} = this.props
    const {selections, filteredChoices, allSelected} = this.state
    let countSelected = selections.size
    const minSelected = minChoices > 0 && countSelected >= minChoices
    const maxSelected = maxChoices > 0 && countSelected >= maxChoices
    const hasPreviousSelections = previousSelections && previousSelections.length > 0
    const hasEnoughPreviousSelections = previousSelections.length >= minChoices
    const hasMorePreviousSelections = previousSelections.length > maxChoices
    return (
      <Dialog open={open} classes={{paper: classes.dialog}}
              onClose={this.props.onCancel} >
        <DialogTitle className={classes.dialogTitle}>
          <Typography className={classes.heading}>{title} ({filteredChoices.length} items)</Typography>
          <Input fullWidth autoFocus
                placeholder="Type here to filter data from the results" 
                onChange={this.onFilterChange}
                onKeyDown={this.onKeyDown}
                className={classes.filterInput}
            />
        </DialogTitle>
        <DialogContent className={classes.dialogContent}>
          {hasPreviousSelections &&
            <ExpansionPanel className={classes.expansion}>
              <ExpansionPanelSummary expandIcon={<ExpandMoreIcon/>} className={classes.expansionHead}>
                <Typography className={classes.expansionHeadText}>Previous Selections</Typography>
              </ExpansionPanelSummary>
              <ExpansionPanelDetails className={classes.expansionDetails}>
                <List component="nav" dense> 
                  {previousSelections.map((item, index) => {
                    let text = item.displayItem[0] + " ["
                    text += item.displayItem.slice(1).join(",")
                    text += "]"
                    return (
                      <ListItem key={index} disableGutters>
                        <ListItemIcon style={{marginRight: 5}}><ChevronRightIcon/></ListItemIcon>
                        <ListItemText style={{paddingLeft: 0}}>
                          <Typography>{text}</Typography>
                        </ListItemText>
                      </ListItem>
                    )
                  })}
                </List>
              </ExpansionPanelDetails>
            </ExpansionPanel>
          }
          <Table className={classes.table} aria-labelledby="tableTitle">
            <TableBody>
            {filteredChoices.map((item, index) => {
              const itemId = item.join(".")
              const text = item[0]
              const subItems = item.slice(1)
              return (
                <TableRow key={index} hover>
                  <TableCell className={classes.tableCell}>
                    <FormControlLabel className={classes.choice}
                      control={
                        <Checkbox checked={selections.has(itemId)}
                                  value={itemId}
                                  disabled={!selections.has(itemId) && maxSelected}
                                  indeterminate={!selections.has(itemId) && maxSelected}
                                  className={classes.choiceCheckbox}
                                  onChange={this.onChange.bind(this, itemId)} />}
                      label={text}
                    />
                    {showChoiceSubItems && subItems.map((subtext, i) =>
                      <span key={i} className={classes.choiceSubtext} 
                      onClick={!selections.has(itemId) && maxSelected ? undefined : this.onChange.bind(this, itemId)}
                      >
                        {subtext}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {filteredChoices.length === 0 &&
              <TableRow>
                <TableCell className={classes.tableCell}>
                  No choice available
                </TableCell>
              </TableRow>
            }
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions className={classes.dialogActions}>
          <div className={classes.floatLeft}>
            <Checkbox checked={allSelected}
                      className={classes.allCheckbox}
                      onChange={this.onSelectAll} />
          </div>
          <div className={classes.floatRight}>
            {hasPreviousSelections &&
              <Button onClick={this.onUsePreviousSelections} 
                      disabled={!hasEnoughPreviousSelections}
                      className={hasEnoughPreviousSelections ? classes.dialogButton : classes.dialogButtonDisabled} >
                { hasMorePreviousSelections ? "Use First " + maxChoices + " Previous Selection(s)" :
                  hasEnoughPreviousSelections ? "Use Previous Selections" : "Not Enough Previous Selections"}
              </Button>
            }
            <Button onClick={this.props.onRefresh} className={classes.dialogButton} >
              Refresh
            </Button>
            <Button onClick={this.props.onCancel} className={classes.dialogButton} >
              Cancel
            </Button>
            <Button onClick={this.onOk} className={minSelected ? classes.dialogButton : classes.dialogButtonDisabled} 
                    disabled={!minSelected} >
              Ok
            </Button>
          </div>
        </DialogActions>
      </Dialog>

    )
  }

}

export default withStyles(styles)(ActionChoiceDialog);
