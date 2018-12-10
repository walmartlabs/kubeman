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
  isGroup: boolean,
}

const getHealthClass = (content, outputManager, classes) : string => {
  const health = content ? content.toLowerCase() : ""
  const healthGood = outputManager.isHealthy(health)
  const healthBad = outputManager.isUnhealthy(health)
  return healthGood ? classes.tableCellHealthGood : 
                    healthBad ? classes.tableCellHealthBad : classes.tableCell

}

const TextCell = withStyles(styles)(({index, content, colSpan, highlight, classes, isGroup, isHealthField, outputManager}: ITableCellProps) => {
  const className = isHealthField ? getHealthClass(content, outputManager, classes)
                    : (highlight && index !==0) ? classes.tableCellHighlight : classes.tableCell
  const isJSON = content.startsWith("{") && content.endsWith("}")
  isJSON && (content = "<pre>" + content + "</pre>")
  content = content.replace("<pre>", 
                "<pre style='font-size:1.1rem; display: inline-block; margin: 0px;'>")
  return (
    <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
              className={className}
              style={{paddingLeft: isGroup ? '2px' : '10px'}}
              dangerouslySetInnerHTML={{__html:content}} />
  )
})

const GridCell = withStyles(styles)(({index, content, colSpan, highlight, classes, isGroup, isHealthField, outputManager}: ITableCellProps) => {
  return (
    <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
              className={(highlight && index !==0) ? classes.tableCellHighlight : classes.tableCell}
              style={{paddingLeft: isGroup ? '2px' : '10px'}} >
      <Table>
        <TableBody>
          {(content as string[]).map((item, i) => {
            const className = isHealthField ? getHealthClass(item, outputManager, classes) : classes.tableCell
            const isJSON = item.startsWith("{") && item.endsWith("}")
            isJSON && (item = "<pre>" + item + "</pre>")
            item = item.replace("<pre>", "<pre style='font-size:1.1rem; display: inline-block; margin: 0px;'>")
            return (
              <TableRow key={i} className={classes.tableRow}>
                <TableCell component="th" scope="row" colSpan={colSpan}
                className={className}
                style={{paddingLeft: isGroup ? '2px' : '10px'}}
                dangerouslySetInnerHTML={{__html:item}} />
              </TableRow>
            )
          })}
        </TableBody>  
      </Table>        
      
    </TableCell>
  )
})

interface IProps extends WithStyles<typeof styles> {
  output: ActionOutput,
  compare?: boolean
  health?: boolean
}

interface IState {
  filterText: string
}

class TableBox extends React.Component<IProps, IState> {

  state: IState = {
    filterText: ''
  }
  outputManager: OutputManager = new OutputManager
  filterTimer: any = undefined

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
    this.outputManager.setOutput(props.output)
    const {filterText} = this.state
    if(filterText !== '') {
      this.filter(filterText)
    }
    this.forceUpdate()
  }

  filter = (inputText: string) => {
    this.outputManager.filter(inputText)
    this.setState({filterText: inputText})
  }

  onFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    if(this.filterTimer) {
      clearTimeout(this.filterTimer)
    }
    const text = event.target.value
    if(text.length === 0) {
      this.outputManager.clearFilter()
      this.setState({filterText: ''})
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
    let tableHasSubgroups = false
    
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
                if(header instanceof Array){
                  return(
                  <TableCell key={ri}>
                    <Typography className={classes.tableHeaderText}>
                    {header.map((text,hi) =>
                      <span key={hi} style={{display: 'block'}}>
                        {text}
                      </span>
                    )}
                    </Typography>
                  </TableCell>
                  )
                } else {
                  return(
                  <TableCell key={ri}>
                    <Typography className={classes.tableHeaderText}>
                      {header}
                    </Typography>
                  </TableCell>
                  )
                }
              })
              }
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => {
              let highlight = compare ? row.diffLastTwoFields() : false
              const components : any[] = []
              tableHasSubgroups = tableHasSubgroups || row.isSubGroup

              if(row.isGroupOrSubgroup) {
                components.push(
                  <TableRow key={index+".pre"} className={classes.tableGroupRow}>
                  </TableRow>
                )
                const field = row.content[0]
                const text = field === "---" ? "" : 
                                row.isSubGroup ? field.slice(1) : field
                components.push(
                  <TableRow key={index+".group"} 
                            className={row.isGroup ? classes.tableGroupRow : classes.tableSubgroupRow}
                  >
                    <TextCell index={0} content={text}
                            colSpan={row.content.length}
                            isGroup={true}
                            outputManager={this.outputManager}
                    />
                  </TableRow>
                )
              } else {
                components.push(
                  <TableRow key={index} 
                      className={classes.tableRow} >
                  {row.content.map((field, ci) => {
                    if(field instanceof Array) {
                      return (
                        <GridCell key={"GridCell"+ci} index={ci} content={field}
                                  isGroup={row.isGroup}
                                  highlight={highlight}
                                  isHealthField={!row.isGroupOrSubgroup && health && ci === healthColumnIndex} 
                                  outputManager={this.outputManager}
                                  />
                      )
                    } else {
                      return (
                        <TextCell key={"TextCell"+ci} index={ci} content={field}
                                  colSpan={1}
                                  isGroup={row.isGroup}
                                  isHealthField={!row.isGroupOrSubgroup && health && ci === healthColumnIndex} 
                                  highlight={highlight} 
                                  outputManager={this.outputManager}
                                  />
                      )
                    }
                  })}
                  </TableRow>
                )
              }
              return components
            })}
          </TableBody>
        </Table>
      </Paper>      
    )
  }
}

export default withStyles(styles)(TableBox)