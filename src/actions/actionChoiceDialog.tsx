import React, { ChangeEvent } from 'react';

import { withStyles, WithStyles} from '@material-ui/core/styles'
import { Button, Input, FormControlLabel, Checkbox, Typography, } from '@material-ui/core';
import { Dialog, DialogTitle, DialogContent, DialogActions, } from '@material-ui/core';
import { Table, TableBody, TableCell, TableRow } from '@material-ui/core';

import {ActionChoices} from './actionSpec'
import styles from './actionChoiceDialog.styles'
import {filter} from '../util/filterUtil'


interface IProps extends WithStyles<typeof styles> {
  open: boolean
  title: string
  choices: ActionChoices
  minChoices: number
  maxChoices: number
  onSelection: (selections: any[]) => void
  onCancel: () => any
}

interface IState {
  selections: Map<any, any>
  filteredChoices: ActionChoices
  filterText: string
}

class ActionChoiceDialog extends React.Component<IProps, IState> {
  static defaultProps = {
    open: false,
  }
  state: IState = {
    selections: new Map,
    filteredChoices: [],
    filterText: ''
  }
  filterTimer: any = undefined

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
    this.setState({filteredChoices: props.choices})
  }

  onChange = (itemId: any, item: any) => {
    const {selections} = this.state
    if(selections.has(itemId)) {
      selections.delete(itemId)
    } else {
      selections.set(itemId, item)
    }
    this.setState({selections})
  }

  filter = (filterText: string) => {
    const {choices} = this.props
    let filteredChoices: any[] = filter(filterText, choices)
    this.setState({filterText: filterText, filteredChoices})
  }

  onFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    if(this.filterTimer) {
      clearTimeout(this.filterTimer)
    }
    const text = event.target.value
    if(text.length === 0) {
      this.setState({filterText: '', filteredChoices: this.props.choices})
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
    const {open, title, minChoices, maxChoices, classes} = this.props
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
              const isArray = item instanceof Array
              const itemId = isArray ? item.join(".") : item
              const text = isArray ? item[0] : item
              const subItems = isArray ? item.slice(1) : []
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
                                  onChange={this.onChange.bind(this, itemId, item)} />}
                      label={text}
                    />
                    {subItems.map((subtext, i) =>
                       <span key={i} className={classes.choiceSubtext} 
                       onClick={!selections.has(itemId) && maxSelected ? undefined : this.onChange.bind(this, itemId, item)}
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
                  No choice available (no namespace selected?)
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
