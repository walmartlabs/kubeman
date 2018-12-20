import React, { ChangeEvent } from "react"

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
  isKeyColumn: boolean,
  highlight: boolean,
  compare: boolean,
  colSpan?: number,
}

function computeCellClass(cell: Cell, isKeyColumn: boolean, highlight: boolean, compare: boolean, classes: any) : string {
  let className = classes.tableCell
  if(!cell.isGroup && !cell.isSubGroup ) {
    if(highlight) {
      className = isKeyColumn ? classes.tableKeyCellHighlight : classes.tableCellHighlight 
    } else if(isKeyColumn) {
      className = classes.tableKeyCell
    } else if(!compare && cell.isHealthStatusField) {
      className = cell.isHealthy ? classes.tableCellHealthGood : 
                      cell.isUnhealthy ? classes.tableCellHealthBad : classes.tableCell
    } 
    compare && (className = className + " " + classes.tableCellCompare)
  }
  return className
}

const TextCell = withStyles(styles)(({index, cell, colSpan, isKeyColumn, highlight, compare, classes}: ITableCellProps) => {
  const className = computeCellClass(cell, isKeyColumn, highlight, compare, classes)
  
  return cell.render((formattedText) =>
    <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
              className={className}
              style={{paddingLeft: cell.isGroup ? '2px' : '10px'}}
              dangerouslySetInnerHTML={{__html:formattedText}} />
  )
})

const GridCell = withStyles(styles)(({index, cell, colSpan, isKeyColumn, highlight, compare, classes}: ITableCellProps) => {
  let className = computeCellClass(cell, isKeyColumn, highlight, compare, classes)
  return (
    <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
              className={className}
              style={{paddingLeft: 2, paddingRight: 2}} >
      <Table>
        <TableBody>
          {cell.render((formattedText, gridIndex) =>
            <TableRow key={gridIndex} className={classes.tableRow + " gridRow"}>
              <TableCell component="th" scope="row" colSpan={colSpan}
              className={className}
              style={{paddingLeft: cell.isGroup ? '2px' : '10px', border: 0}}
              dangerouslySetInnerHTML={{__html:formattedText}} />
            </TableRow>
          )}
        </TableBody>  
      </Table>        
      
    </TableCell>
  )
})

interface IProps extends WithStyles<typeof styles> {
  output: ActionOutput,
  compare?: boolean
}

interface IState {
  filterText: string
}

export class TableBox extends React.Component<IProps, IState> {

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

  appendOutput(output: ActionOutput) {
    this.outputManager.appendRows(output)
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
    rowIndex > 0 && components.push(
      <TableRow key={rowIndex+".pre"} className={classes.tableGroupRow}>
      </TableRow>
    )
    components.push(
      <TableRow key={rowIndex+".group"} 
                className={row.isGroup ? classes.tableGroupRow : classes.tableSubgroupRow}
      >
        <TextCell index={0} 
                  cell={row.cells[0]}
                  isKeyColumn={false}
                  highlight={false}
                  compare={false}
                  colSpan={row.columnCount}
        />
      </TableRow>
    )
    return components
  }

  renderRow(row: Row, rowIndex: number) {
    const {classes, compare} = this.props
    let highlight = compare ? row.lastTwoColumnsDiffer : false
    return (
      <TableRow key={rowIndex} 
          className={classes.tableRow} >
      {row.cells.map((cell, ci) => {
        if(cell.isArray) {
          return (
            <GridCell key={"GridCell"+ci} 
                      index={ci} 
                      cell={cell}
                      isKeyColumn={cell.isFirstColumn && row.columnCount > 1}
                      highlight={highlight || false}
                      compare={ci !== 0 && compare || false}
                      />
          )
        } else {
          return (
            <TextCell key={"TextCell"+ci} 
                      index={ci} 
                      cell={cell}
                      isKeyColumn={cell.isFirstColumn && row.columnCount > 1}
                      highlight={highlight || false} 
                      compare={compare || false}
                      colSpan={1}
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
    const columnCount = rows.length > 0 ? rows[0].columnCount : 1
    
    return (
      <div className={classes.root}>
        <Paper  className={classes.filterContainer}>
          <Input  fullWidth disableUnderline
                  placeholder="Type here to filter data from the results" 
                  onChange={this.onFilterChange}
                  className={classes.filterInput}
          />
        </Paper>
        <Table className={classes.tableContainer}>
          <TableHead>
            {this.renderHeaderRow()}
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={columnCount} style={{width: '100%', padding: 0}}>
                <div className={classes.tableBody}>
                  <Table className={classes.table}>
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
                </div>  
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>      
    )
  }
}

export default withStyles(styles)(TableBox)