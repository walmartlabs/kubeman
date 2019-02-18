import React, { ChangeEvent } from 'react';

import { withStyles, WithStyles} from '@material-ui/core/styles'
import { Button, Input, FormControlLabel, Checkbox, Typography, } from '@material-ui/core';
import { Dialog, DialogTitle, DialogContent, DialogActions, } from '@material-ui/core';
import { Table, TableBody, TableCell, TableRow } from '@material-ui/core';

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
  onSelection: (selections: any[]) => void
  onCancel: () => any
}

interface IState {
  selections: Map<any, any>
  choiceItems: any[][]
  choiceDataMap: Map<any, any>
  filteredChoices: any[][]
  filterText: string
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
    filterText: ''
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
    this.setState({filterText: filterText, filteredChoices: filter(filterText, choiceItems)})
  }

  onFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    if(this.filterTimer) {
      clearTimeout(this.filterTimer)
    }
    const text = event.target.value
    if(text.length === 0) {
      const {choiceItems} = this.state
      this.setState({filterText: '', filteredChoices: choiceItems})
    } else {
      this.filterTimer = setTimeout(this.filter.bind(this, text), 400)
    }
  }

  onCancel = () => {
    this.props.onCancel()
  }

  onOk = () => {
    const {selections} = this.state
    this.props.onSelection(Array.from(selections.values()))
  }

  render() {
    const {open, title, minChoices, maxChoices, showChoiceSubItems, classes} = this.props
    const {selections, filteredChoices} = this.state
    let countSelected = selections.size
    const minSelected = minChoices > 0 && countSelected >= minChoices
    const maxSelected = maxChoices > 0 && countSelected >= maxChoices
    
    return (
      <Dialog open={open} className={classes.dialog}
              onClose={this.onCancel} >
        <DialogTitle className={classes.dialogTitle}>
          <Typography className={classes.heading}>{title}</Typography>
          <Input  fullWidth
                placeholder="Type here to filter data from the results" 
                onChange={this.onFilterChange}
                className={classes.filterInput}
            />
        </DialogTitle>
        <DialogContent className={classes.dialogContent}>
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
          <Button onClick={this.onCancel} className={classes.dialogButton} >
            Cancel
          </Button>
          <Button onClick={this.onOk} className={minSelected ? classes.dialogButton : classes.dialogButtonDisabled} 
                  disabled={!minSelected} >
            Ok
          </Button>
        </DialogActions>
      </Dialog>

    )
  }

}

export default withStyles(styles)(ActionChoiceDialog);
