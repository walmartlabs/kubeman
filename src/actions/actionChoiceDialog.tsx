import React from 'react';
import { isNullOrUndefined } from 'util';

import { withStyles, WithStyles, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { AppBar, Button, FormHelperText, FormControlLabel, Checkbox, Typography, } from '@material-ui/core';
import { Dialog, DialogContent, DialogActions, } from '@material-ui/core';
import { Table, TableBody, TableCell, TableRow } from '@material-ui/core';

import {ActionChoices} from './actionSpec'
import styles from './actionChoiceDialog.styles'


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
}

class ActionChoiceDialog extends React.Component<IProps, IState> {
  static defaultProps = {
    open: false,
  }
  state: IState = {
    selections: new Map
  }

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
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

  onCancel = () => {
    this.props.onCancel()
  }

  onOk = () => {
    const {selections} = this.state
    this.props.onSelection(Array.from(selections.values()))
  }

  render() {
    const {open, title, choices, minChoices, maxChoices, classes} = this.props
    const {selections} = this.state
    let countSelected = selections.size
    const minSelected = minChoices > 0 && countSelected >= minChoices
    const maxSelected = maxChoices > 0 && countSelected >= maxChoices

    return (
      <Dialog open={open} className={classes.dialog}
              onClose={this.onCancel} >
        <DialogContent className={classes.dialogContent}>
          <AppBar position="static" className={classes.appBar}>
            <Typography className={classes.heading}>{title}</Typography>
          </AppBar>
          <Table className={classes.table} aria-labelledby="tableTitle">
            <TableBody>
            {choices.map((item, index) => {
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
                        onClick={this.onChange.bind(this, itemId, item)}
                       >
                        {subtext}
                       </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
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
