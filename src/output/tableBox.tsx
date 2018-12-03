import React from "react";

import { withStyles, WithStyles } from '@material-ui/core/styles'
import { Table, TableHead, TableBody, TableRow, TableCell } from "@material-ui/core";
import {Paper, Typography} from '@material-ui/core';

import styles from './tableBox.styles'

interface IState {
}

interface IProps extends WithStyles<typeof styles> {
  output: string[][],
  compare?: boolean
}


interface ITableCellProps extends WithStyles<typeof styles> {
  key: string,
  text: string,
  highlight?: boolean,
}

const TextCell = withStyles(styles)(({key, text, highlight, classes}: ITableCellProps) => {
  return (
    <TableCell key={key} component="th" scope="row" className={classes.tableCell}>
      {text}
    </TableCell>
  )
})

const TableBox = withStyles(styles)(({classes, output, compare} : IProps) => {
  if(output.length < 1)
    return <div/>
  const headers = output.slice(0, 1)[0]
  const rows = output.slice(1)
  return (
    <Paper className={classes.root}>
      <Table className={classes.table}>
        <TableHead>
          <TableRow className={classes.tableHeaderRow}>
            {headers.map((header, ri) =>
              <TableCell key={ri}>{header}</TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => {
            const lastField = row.length > 0 ? row[row.length-1] : undefined
            const isGroup = lastField ? lastField.includes("---") : true
            let highlight = false
            if(compare && row.length > 2) {
              const secondLastField = row[row.length-2]
              highlight = lastField ? secondLastField.localeCompare(lastField) !== 0 : false
            }
            return (
              <TableRow key={index} className={isGroup?classes.tableGroupRow :
                                      highlight? classes.tableRowHighlight : classes.tableRow}>
              {row.map((field, ci) => {
                return <TextCell key={"col"+ci} 
                        text={isGroup && ci>0 ? "" : field} 
                        highlight={highlight}
                        />
              })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Paper>      
  )
})

export default TableBox