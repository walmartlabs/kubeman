import React from "react";

import { withStyles, WithStyles } from '@material-ui/core/styles'
import { Table, TableHead, TableBody, TableRow, TableCell } from "@material-ui/core";
import {Paper, Typography} from '@material-ui/core';

import styles from './tableBox.styles'

const healthyKeywords : string[] = [
  "active", "healthy", "good", "green", "up"
]
const unhealthyKeywords : string[] = [
  "inactive", "unhealthy", "bad", "red", "down"
]

interface IState {
}

interface IProps extends WithStyles<typeof styles> {
  output: string[][],
}

const HealthStatusBox = withStyles(styles)(({classes, output} : IProps) => {
  if(output.length < 1)
    return <div/>
  const headers = output.slice(0, 1)[0]
  let healthFieldIndex = headers.map(header => header.toLowerCase())
      .map((header,index) => (header.includes("status") || header.includes("health")?index:-1))
      .reduce((prev, curr) => prev >= 0 ? prev : curr >= 0 ? curr : -1)

  healthFieldIndex = healthFieldIndex >= 0 ? healthFieldIndex : headers.length-1

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
              {row.map((field, ci) => {
                const hideData = isGroup && ci > 0
                const isHealthField = !isGroup && ci === healthFieldIndex
                const health = field.toLowerCase()
                const healthGood = healthyKeywords.filter(word => health.includes(word)).length > 0
                                    && unhealthyKeywords.filter(word => health.includes(word)).length == 0
                const healthBad = unhealthyKeywords.filter(word => health.includes(word)).length > 0
                const className = !isHealthField ? classes.tableCell :
                      healthGood ? classes.tableCellHealthGood : 
                      healthBad ? classes.tableCellHealthBad : classes.tableCell
                return (
                  <TableCell key={"col"+ci} component="th" scope="row" 
                              className={className}
                  >
                    {hideData ? "" : field}
                  </TableCell>
                )
              })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Paper>      
  )
})

export default HealthStatusBox