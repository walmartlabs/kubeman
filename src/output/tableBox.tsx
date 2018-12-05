import React, { ChangeEvent } from "react";

import { withStyles, WithStyles } from '@material-ui/core/styles'
import { Table, TableHead, TableBody, TableRow, TableCell } from "@material-ui/core";
import { Grid, Paper, Typography, TextField } from '@material-ui/core';

import styles from './tableBox.styles'
import { ActionOutput } from "../actions/actionSpec";

const healthyKeywords : string[] = [
  "active", "healthy", "good", "green", "up", "run"
]
const unhealthyKeywords : string[] = [
  "inactive", "unhealthy", "bad", "red", "down", "stop", "terminat"
]



interface ITableCellProps extends WithStyles<typeof styles> {
  index: number,
  content: any,
  colSpan?: number,
  highlight?: boolean,
  isHealthField?: boolean,
}

const TextCell = withStyles(styles)(({index, content, colSpan, highlight, classes}: ITableCellProps) => {
  content = content.split("<br/>")
  return (
    <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
              className={(highlight && index !==0) ? classes.tableCellHighlight : classes.tableCell}>
      {content.map((text,i) => <span key={"CellContent"+i}>{text}<br/></span>)}
    </TableCell>
  )
})

const GridCell = withStyles(styles)(({index, content, colSpan, highlight, classes}: ITableCellProps) => {
  return (
    <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
              className={(highlight && index !==0) ? classes.tableCellHighlight : classes.tableCell}>
      <Grid container direction='column' spacing={8} className={classes.grid} >
        {(content as string[]).map((item, i) => 
          <Grid key={"GridItem"+i} item xs={12} md={12} className={classes.gridCell}>
            {item}
          </Grid>
        )}
      </Grid>
      
    </TableCell>
  )
})

const HealthCell = withStyles(styles)(({index, content, colSpan, isHealthField, classes}: ITableCellProps) => {
  const health = content ? content.toLowerCase() : ""
  const healthGood = healthyKeywords.filter(word => health.includes(word)).length > 0
                      && unhealthyKeywords.filter(word => health.includes(word)).length == 0
  const healthBad = unhealthyKeywords.filter(word => health.includes(word)).length > 0
  const className = !isHealthField ? classes.tableCell :
        healthGood ? classes.tableCellHealthGood : 
        healthBad ? classes.tableCellHealthBad : classes.tableCell
  content = content.split("<br/>")
  return (
    <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
               className={className}>
      {content.map((text,i) => <span key={"CellContent"+i}>{text}<br/></span>)}
    </TableCell>
  )
})

interface IProps extends WithStyles<typeof styles> {
  output: ActionOutput,
  compare?: boolean
  health?: boolean
}

interface IState {
  filteredOutput: ActionOutput,
}

class TableBox extends React.Component<IProps, IState> {

  state: IState = {
    filteredOutput: [],
  }

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
    this.setState({filteredOutput: this.props.output})
  }


  onFilter = (event: ChangeEvent<HTMLInputElement>) => {
    const {output} = this.props
    const filterText = event.target.value.toLowerCase()
    let filteredOutput: ActionOutput = []

    if(filterText.length === 0) {
      filteredOutput = output
    } else {
      filteredOutput = output.slice(1).filter(row => {
        const lastField = row.length > 1 ? row[row.length-1] : undefined
        const isGroup = lastField && lastField.includes("---") || false
        if(isGroup) {
          return true
        } else {
          return row.filter(item =>
            typeof item === 'string' ? 
                item.toLowerCase().includes(filterText)
            : item instanceof Array ? 
                item.filter(i => i.toLowerCase().includes(filterText)).length > 0 
            : false
          ).length > 0
        }
      })
      filteredOutput.unshift(output[0])
    }
    this.setState({filteredOutput})
  }

  render() {
    const {classes, compare, health} = this.props
    const {filteredOutput: output} = this.state
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
        <TextField  fullWidth
                    placeholder="Type here to filter data from the results" 
                    InputLabelProps={{
                      shrink: true,
                    }}
                    onChange={this.onFilter}
        />
        <Table className={classes.table}>
          <TableHead>
            <TableRow className={classes.tableHeaderRow}>
              {headers.map((header, ri) => {
                header = header.split("<br/>")
                return (
                <TableCell key={ri}>
                  <Typography className={classes.tableHeaderText}>
                  {header.map((text,i) => <span key={"CellContent"+i}>{text}<br/></span>)}
                  </Typography>
                </TableCell>
                )
              })}
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
                    if(field instanceof Array) {
                      return (
                        <GridCell key={"GridCell"+ci} index={ci} content={field}
                                  highlight={highlight} />
                      )
                    } else {
                      const text = isGroup && field === "---" ? "" : field
                      const colspan = isGroup && field !== "---" ? row.length/2 : 1
                      if(health) {
                        return (
                          <HealthCell key={"HealthCell"+ci} index={ci} content={text} 
                                      colSpan={colspan}
                                      isHealthField={!isGroup && ci === healthFieldIndex} />
                        )
                      } else {
                        return (
                          <TextCell key={"TextCell"+ci} index={ci} content={text}
                                    colSpan={colspan}
                                    highlight={highlight} />
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