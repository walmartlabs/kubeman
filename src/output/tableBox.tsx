import React from "react";

import { withStyles, WithStyles } from '@material-ui/core/styles'
import { Table, TableHead, TableBody, TableRow, TableCell } from "@material-ui/core";
import {Paper, Typography} from '@material-ui/core';

import styles from './tableBox.styles'

interface IState {
}

interface IProps extends WithStyles<typeof styles> {
  output: string[][],
}

const TableBox = withStyles(styles)(({classes, output} : IProps) => {
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
            const lastField = row[row.length-1]
            const isGroup = lastField.includes("---")
            return (
              <TableRow key={index} className={isGroup?classes.tableGroupRow:classes.tableRow}>
              {row.map((field, ci) =>
                  <TableCell key={"col"+ci} component="th" scope="row" className={classes.tableCell}>
                    {isGroup && ci>0 ? "" : field}
                  </TableCell>
              )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Paper>      
  )
})

export default TableBox