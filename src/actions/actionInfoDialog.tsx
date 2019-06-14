/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import React, { ChangeEvent } from 'react';

import { withStyles, WithStyles} from '@material-ui/core/styles'
import { Button, Input, Typography, } from '@material-ui/core';
import { Dialog, DialogTitle, DialogContent, DialogActions, } from '@material-ui/core';
import { Table, TableBody, TableCell, TableRow } from '@material-ui/core';

import styles from './actionChoiceDialog.styles'
import {filter} from '../util/filterUtil'


interface IProps extends WithStyles<typeof styles> {
  open: boolean
  title: string
  items: any[]
  onOK: () => void
  onCancel: () => any
}

interface IState {
  filteredItems: any[]
  filterText: string
}

class ActionInfoDialog extends React.Component<IProps, IState> {
  static defaultProps = {
    open: false,
  }
  state: IState = {
    filteredItems: [],
    filterText: ''
  }
  filterTimer: any = undefined

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
    this.setState({filteredItems: props.items})
  }

  filter = (filterText: string) => {
    const {items} = this.props
    let filteredItems: any[] = filter(filterText, items)
    this.setState({filterText: filterText, filteredItems})
  }

  onFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    if(this.filterTimer) {
      clearTimeout(this.filterTimer)
    }
    const text = event.target.value
    if(text.length === 0) {
      this.setState({filterText: '', filteredItems: this.props.items})
    } else {
      this.filterTimer = setTimeout(this.filter.bind(this, text), 400)
    }
  }

  onCancel = () => {
    this.props.onCancel()
  }

  onOk = () => {
    this.props.onOK()
  }

  render() {
    const {open, title, classes} = this.props
    const {filteredItems} = this.state

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
            {filteredItems.map((item, index) => {
              const isArray = item instanceof Array
              const itemId = isArray ? item.join(".") : item
              const text = isArray ? item[0] : item
              const subItems = isArray ? item.slice(1) : []
              return (
                <TableRow key={index} hover>
                  <TableCell className={classes.tableCell}>
                    {text}
                    {subItems.map((subtext, i) =>
                       <span key={i} className={classes.choiceSubtext}>
                        {subtext}
                       </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {filteredItems.length === 0 &&
              <TableRow>
                <TableCell className={classes.tableCell}>
                  No info available
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
          <Button onClick={this.onOk} className={classes.dialogButton}>
            Ok
          </Button>
        </DialogActions>
      </Dialog>

    )
  }

}

export default withStyles(styles)(ActionInfoDialog);
