import React, { ChangeEvent } from "react";

import { withStyles, WithStyles } from '@material-ui/core/styles'
import { Table, TableHead, TableBody, TableRow, TableCell } from "@material-ui/core";
import { Paper, Typography, Input } from '@material-ui/core';

import { ActionOutput } from "../actions/actionSpec";
import OutputManager, {Row, Cell} from './outputManager'
import styles from './tableBox.styles'
import './tableBox.css'

interface ITableCellProps extends WithStyles<typeof styles> {
  index: number,
  cell: Cell,
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

const TextCell = withStyles(styles)(({index, cell, colSpan, highlight, classes, isGroup, isHealthField, outputManager}: ITableCellProps) => {
  let text = isGroup ? cell.groupText : cell.text
  const className = isHealthField ? getHealthClass(cell.text, outputManager, classes)
                    : highlight ? classes.tableCellHighlight 
                    : index === 0 && !isGroup ? classes.tableKeyCell : classes.tableCell
  cell.isJSON && (text = "<pre>" + text + "</pre>")
  return (
    <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
              className={className}
              style={{paddingLeft: isGroup ? '2px' : '10px'}}
              dangerouslySetInnerHTML={{__html:text}} />
  )
})

const GridCell = withStyles(styles)(({index, cell, colSpan, highlight, classes, isGroup, isHealthField, outputManager}: ITableCellProps) => {
  const outerCellClass = highlight ? classes.tableCellHighlight : classes.tableCell
  return (
    <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
              className={outerCellClass}
              style={{paddingLeft: isGroup ? '2px' : '10px'}} >
      <Table>
        <TableBody>
          {cell.map((formattedText, text, index) => {
            const innerCellClass = isHealthField ? getHealthClass(text, outputManager, classes)
                              : index === 0 ? classes.tableKeyCell : 
                              highlight? classes.tableCellHighlight : classes.tableCell
            return (
              <TableRow key={index} className={classes.tableRow}>
                <TableCell component="th" scope="row" colSpan={colSpan}
                className={innerCellClass}
                style={{paddingLeft: isGroup ? '2px' : '10px', border: 0}}
                dangerouslySetInnerHTML={{__html:formattedText}} />
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

  renderGroupRow(row: Row, rowIndex: number) {
    const {classes} = this.props
    const components : any[] = []
    components.push(
      <TableRow key={rowIndex+".pre"} className={classes.tableGroupRow}>
      </TableRow>
    )
    components.push(
      <TableRow key={rowIndex+".group"} 
                className={row.isGroup ? classes.tableGroupRow : classes.tableSubgroupRow}
      >
        <TextCell index={0} 
                cell={row.cells[0]}
                colSpan={row.columnCount}
                isGroup={true}
                outputManager={this.outputManager}
        />
      </TableRow>
    )
    return components
  }

  renderRow(row: Row, rowIndex: number) {
    const {classes, compare, health} = this.props
    let highlight = compare ? row.lastTwoColumnsDiffer : false
    const healthColumnIndex = this.outputManager.healthColumnIndex
    return (
      <TableRow key={rowIndex} 
          className={classes.tableRow} >
      {row.cells.map((cell, ci) => {
        if(cell.isArray) {
          return (
            <GridCell key={"GridCell"+ci} 
                      index={ci} 
                      cell={cell}
                      isGroup={row.isGroup}
                      highlight={ci !== 0 && highlight}
                      isHealthField={!row.isGroupOrSubgroup && health && ci === healthColumnIndex} 
                      outputManager={this.outputManager}
                      />
          )
        } else {
          return (
            <TextCell key={"TextCell"+ci} 
                      index={ci} 
                      cell={cell}
                      colSpan={1}
                      isGroup={row.isGroup}
                      isHealthField={!row.isGroupOrSubgroup && health && ci === healthColumnIndex} 
                      highlight={ci !== 0 && highlight} 
                      outputManager={this.outputManager}
                      />
          )
        }
      })}
      </TableRow>
    )
  }

  renderHeaderRow() {
    const {classes} = this.props
    const headers = this.outputManager.headers
    return (
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
    )
  }

  render() {
    const {classes} = this.props

    if(!this.outputManager.hasContent) {
      return <div/>
    }

    const rows = this.outputManager.filteredRows
    
    return (
      <Paper className={classes.root}>
        <Input  fullWidth
                placeholder="Type here to filter data from the results" 
                onChange={this.onFilterChange}
                className={classes.filterInput}
        />
        <Table className={classes.table}>
          <TableHead>
            {this.renderHeaderRow()}
          </TableHead>
          <TableBody>
            {rows.map((row, index) => {
              if(row.isGroupOrSubgroup) {
                return this.renderGroupRow(row, index)
              } else {
                return this.renderRow(row, index)
              }
            })}
          </TableBody>
        </Table>
      </Paper>      
    )
  }
}

export default withStyles(styles)(TableBox)