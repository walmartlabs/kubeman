import React, { ChangeEvent } from "react";

import { withStyles, WithStyles } from '@material-ui/core/styles'
import { Table, TableHead, TableBody, TableRow, TableCell } from "@material-ui/core";
import { Grid, Paper, Typography, Input } from '@material-ui/core';

import styles from './tableBox.styles'
import { ActionOutput } from "../actions/actionSpec";
import OutputManager from './outputManager'


interface ITableCellProps extends WithStyles<typeof styles> {
  index: number,
  content: any,
  colSpan?: number,
  highlight?: boolean,
  isHealthField?: boolean,
  outputManager: OutputManager,
}

const TextCell = withStyles(styles)(({index, content, colSpan, highlight, classes}: ITableCellProps) => {
  return (
    <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
              className={(highlight && index !==0) ? classes.tableCellHighlight : classes.tableCell}
              dangerouslySetInnerHTML={{__html:content}} />
  )
})

const GridCell = withStyles(styles)(({index, content, colSpan, highlight, classes}: ITableCellProps) => {
  return (
    <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
              className={(highlight && index !==0) ? classes.tableCellHighlight : classes.tableCell}>
      <Grid container direction='column' spacing={8} className={classes.grid} >
        {(content as string[]).map((item, i) => 
          <Grid key={"GridItem"+i} item xs={12} md={12} 
                className={classes.gridCell}
                dangerouslySetInnerHTML={{__html:item}} />
        )}
      </Grid>
      
    </TableCell>
  )
})

const HealthCell = withStyles(styles)(({index, content, colSpan, isHealthField, classes, outputManager}: ITableCellProps) => {
  const health = content ? content.toLowerCase() : ""
  const healthGood = outputManager.isHealthy(health)
  const healthBad = outputManager.isUnhealthy(health)
  const className = !isHealthField ? classes.tableCell :
        healthGood ? classes.tableCellHealthGood : 
        healthBad ? classes.tableCellHealthBad : classes.tableCell
  return (
    <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
               className={className} 
               dangerouslySetInnerHTML={{__html:content}} />
  )
})

interface IProps extends WithStyles<typeof styles> {
  output: ActionOutput,
  compare?: boolean
  health?: boolean
}

interface IState {
}

class TableBox extends React.Component<IProps, IState> {

  state: IState = {
  }
  outputManager: OutputManager = new OutputManager
  filterTimer: any = undefined

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
    this.outputManager.setOutput(this.props.output)
    this.forceUpdate()
  }

  filter = (inputText: string) => {
    this.outputManager.filter(inputText)
    this.forceUpdate()
  }

  onFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    if(this.filterTimer) {
      clearTimeout(this.filterTimer)
    }
    const text = event.target.value
    if(text.length === 0) {
      this.outputManager.clearFilter()
      this.forceUpdate()
    } else {
      this.filterTimer = setTimeout(this.filter.bind(this, text), 500)
    }
  }

  render() {
    const {classes, compare, health} = this.props
    
    if(!this.outputManager.hasFilteredContent) {
      return <div/>
    }

    const headers = this.outputManager.getHeaders()
    const rows = this.outputManager.rows
    const healthColumnIndex = this.outputManager.getHealthColumnIndex()
    
    return (
      <Paper className={classes.root}>
        <Input  fullWidth
                placeholder="Type here to filter data from the results" 
                onChange={this.onFilterChange}
                className={classes.filterInput}
        />
        <Table className={classes.table}>
          <TableHead>
            <TableRow className={classes.tableHeaderRow}>
              {headers.map((header, ri) => {
                return (
                <TableCell key={ri}>
                  <Typography className={classes.tableHeaderText}
                  dangerouslySetInnerHTML={{__html:header}} />
                </TableCell>
                )
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => {
              let highlight = compare ? row.diffLastTwoFields() : false
              const components : any[] = []

              if(row.isGroupOrSubgroup) {
                components.push(
                  <TableRow key={index+".pre"} className={classes.tableGroupRow}>
                  </TableRow>
                )
              }

              components.push(
                  <TableRow key={index} className={
                      row.isGroup ? classes.tableGroupRow :
                      row.isSubGroup ? classes.tableSubgroupRow : classes.tableRow}>
                  
                  {row.content.map((field, ci) => {
                    if(field instanceof Array) {
                      return (
                        <GridCell key={"GridCell"+ci} index={ci} content={field}
                                  highlight={highlight} 
                                  outputManager={this.outputManager}
                                  />
                      )
                    } else {
                      const text = row.isGroupOrSubgroup && field === "---" ? "" : 
                                      row.isSubGroup && ci === 0 ? field.slice(1) : field

                      const colspan = row.isGroupOrSubgroup && field !== "---" ? row.content.length/2+1 : 1
                      if(health) {
                        return (
                          <HealthCell key={"HealthCell"+ci} index={ci} content={text} 
                                      colSpan={colspan}
                                      isHealthField={!row.isGroupOrSubgroup && ci === healthColumnIndex} 
                                      outputManager={this.outputManager}
                                      />
                        )
                      } else {
                        return (
                          <TextCell key={"TextCell"+ci} index={ci} content={text}
                                    colSpan={colspan}
                                    highlight={highlight} 
                                    outputManager={this.outputManager}
                                    />
                        )
                      }
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
  }
}

export default withStyles(styles)(TableBox)