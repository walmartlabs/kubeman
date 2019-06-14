/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import React from "react";
import _ from 'lodash'

import { withStyles, WithStyles } from '@material-ui/core/styles'
import {Card, CardContent, CardActions, Typography} from '@material-ui/core';
import { Table, TableBody, TableRow, TableCell } from "@material-ui/core";
import { ActionOutput } from "../actions/actionSpec";

import styles from './blackbox.styles'

interface IState {
}

interface IProps extends WithStyles<typeof styles> {
  output: ActionOutput|string[],
}

const BlackBox = withStyles(styles)(
class extends React.Component<IProps, IState> {
  state: IState = {
  }

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
  }

  writeLine = (text: string, index?: number) => {
    const {classes, ...others} = this.props
    return (
    <Typography key={index || 0} variant="subtitle2" gutterBottom className={classes.text}>
      {text}
    </Typography>
    )
  }

  writeLines = (output: string[]) => {
    return _.flatten(output).map(this.writeLine)
  }

  writeFlatTable(output: ActionOutput) {
    const {classes, ...others} = this.props
    return (
      <Table className={classes.table}>
        <TableBody className={classes.tableBody}>
          {output.map((row, rowIndex) => {
            const fullLine = row[0].includes("---")
            const halfLine = row[0].includes("--")
            const className = fullLine ? classes.tableCellFullLine :
                                halfLine ? classes.tableCellHalfLine : classes.tableCell

            return (
            <TableRow key={rowIndex} className={classes.tableRow}>
              <TableCell className={className}>
              {
                fullLine || halfLine ? ""  : row.map((field, colIndex) => 
                  <Typography key={rowIndex+"-"+colIndex} variant="subtitle2" gutterBottom className={classes.text}>
                  {field}
                  </Typography>)
              }
              </TableCell>
            </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )  
  }

  writeTable(output: ActionOutput) {
    const {classes, ...others} = this.props
    return (
    <Table className={classes.table}>
      <TableBody className={classes.tableBody}>
        {output.map((row, index) =>
          <TableRow key={index} className={classes.tableRow}>
            {row.map((field, index) =>
              <TableCell key={index} className={classes.tableCell}>
                <Typography variant="subtitle2" gutterBottom
                      className={classes.text}>
                  {field}
                </Typography>  
              </TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
    )
  }
 

  render() {
    const {classes, ...others} = this.props
    const {output} = this.props
    const colCount = output.length > 0 ? output[0] instanceof Array ? output[0].length : output.length : 0
    return (
      <Card className={classes.card}>
        <CardContent className={classes.cardContent}>
          {colCount === 1 ? 
            this.writeLines(output as string[])
            : 
            this.writeFlatTable(output as ActionOutput)
          }
        </CardContent>
      </Card>
    )
  }
}
)

export default BlackBox