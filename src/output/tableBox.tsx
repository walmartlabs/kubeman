import React from "react";

import { withStyles, WithStyles } from '@material-ui/core/styles'
import { Table, TableHead, TableBody, TableRow, TableCell } from "@material-ui/core";
import {Paper, Typography} from '@material-ui/core';

import styles from './tableBox.styles'

const healthyKeywords : string[] = [
  "active", "healthy", "good", "green", "up", "run"
]
const unhealthyKeywords : string[] = [
  "inactive", "unhealthy", "bad", "red", "down", "stop", "terminat"
]



interface ITableCellProps extends WithStyles<typeof styles> {
  index: number,
  text: string,
  highlight?: boolean,
}

const TextCell = withStyles(styles)(({index, text, highlight, classes}: ITableCellProps) => {
  return (
    <TableCell key={"col"+index} component="th" scope="row" 
              className={(highlight && index !==0) ? classes.tableCellHighlight : classes.tableCell}>
      {text}
    </TableCell>
  )
})


interface IHealthCellProps extends WithStyles<typeof styles> {
  index: number,
  text: string,
  isHealthField: boolean,
}

const HealthCell = withStyles(styles)(({index, text, isHealthField, classes}: IHealthCellProps) => {
  const health = text ? text.toLowerCase() : ""
  const healthGood = healthyKeywords.filter(word => health.includes(word)).length > 0
                      && unhealthyKeywords.filter(word => health.includes(word)).length == 0
  const healthBad = unhealthyKeywords.filter(word => health.includes(word)).length > 0
  const className = !isHealthField ? classes.tableCell :
        healthGood ? classes.tableCellHealthGood : 
        healthBad ? classes.tableCellHealthBad : classes.tableCell
  return (
    <TableCell key={"col"+index} component="th" scope="row" className={className}>
      {text}
    </TableCell>
  )
})

interface IState {
}

interface IProps extends WithStyles<typeof styles> {
  output: string[][],
  compare?: boolean
  health?: boolean
}

const TableBox = withStyles(styles)(({classes, output, compare, health} : IProps) => {
  if(output.length < 1) {
    return <div/>
  }

  const headers = output.slice(0, 1)[0]
  const rows = output.slice(1)
  let healthFieldIndex = headers.map(header => header.toLowerCase())
      .map((header,index) => (header.includes("status") || header.includes("health")?index:-1))
      .reduce((prev, curr) => prev >= 0 ? prev : curr >= 0 ? curr : -1)
  healthFieldIndex = healthFieldIndex >= 0 ? healthFieldIndex : headers.length-1
  
  return (
    <Paper className={classes.root}>
      <Table className={classes.table}>
        <TableHead>
          <TableRow className={classes.tableHeaderRow}>
            {headers.map((header, ri) =>
              <TableCell key={ri}>
                <Typography className={classes.tableHeaderText}>{header}</Typography>
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => {
            const firstField = row.length > 0 ? row[0] : undefined
            const lastField = row.length > 1 ? row[row.length-1] : undefined
            const isGroup = lastField && lastField.includes("---") || false
            const isSubgroup = firstField && firstField.startsWith(">")
            isSubgroup && (row[0] = row[0].substring(1))
            let highlight = false
            if(compare && row.length > 2) {
              const secondLastField = row[row.length-2]
              highlight = lastField ? secondLastField.localeCompare(lastField) !== 0 : false
            }

            const components : any[] = []
            if(isGroup && !isSubgroup) {
              components.push(
                <TableRow key={index+".pre"} className={classes.tableGroupRow}>
                </TableRow>
              )
            } 
            components.push(
                <TableRow key={index} className={
                    (isGroup && !isSubgroup) ? classes.tableGroupRow :
                    isSubgroup ? classes.tableSubgroupRow : classes.tableRow}>
                {row.map((field, ci) => {
                  const text = isGroup && field === "---" ? "" : field
                  if(compare) {
                    return (
                      <TextCell key={"TextCell"+ci} index={ci} 
                                text={text} 
                                highlight={highlight} />
                    )
                  } else if (health) {
                    return (
                      <HealthCell key={"HealthCell"+ci} index={ci} 
                                  text={text} 
                                  isHealthField={!isGroup && ci === healthFieldIndex} />
                    )
                  } else {
                    return ""
                  }
                })}
                </TableRow>
            )
            return components
          })}
        </TableBody>
      </Table>
    </Paper>      
  )
})

export default TableBox