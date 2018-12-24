import React, { ChangeEvent, KeyboardEvent, SyntheticEvent } from "react"

import { withStyles, WithStyles } from '@material-ui/core/styles'
import { Table, TableHead, TableBody, TableRow, TableCell } from "@material-ui/core";
import { Paper, Typography, Input, CircularProgress } from '@material-ui/core';

import { ActionOutput } from "../actions/actionSpec";
import OutputManager, {Row, Cell} from './outputManager'
import styles from './tableBox.styles'
import './tableBox.css'


interface ITableCellProps extends WithStyles<typeof styles> {
  index: number
  cell: Cell
  isKeyColumn: boolean
  highlight: boolean
  compare: boolean
  colSpan?: number
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
  return cell.render((formattedText) => {
    return (
      <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
                className={className}
                style={{paddingLeft: cell.isGroup ? '2px' : '10px'}}
                dangerouslySetInnerHTML={{__html:formattedText}} />
    )})
})

const GridCell = withStyles(styles)(({index, cell, colSpan, isKeyColumn, highlight, compare, classes}: ITableCellProps) => {
  let className = computeCellClass(cell, isKeyColumn, highlight, compare, classes)
  return (
    <TableCell key={"col"+index} component="th" scope="row" colSpan={colSpan}
              className={className}
              style={{paddingLeft: 2, paddingRight: 2}} >
      <Table>
        <TableBody>
          {cell.render((formattedText, gridIndex) => {
            return (
              <TableRow key={gridIndex} className={classes.tableRow + " gridRow"}>
                <TableCell component="th" scope="row" colSpan={colSpan}
                className={className}
                style={{paddingLeft: cell.isGroup ? '2px' : '10px', border: 0}}
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
  output: ActionOutput
  compare?: boolean
  log: boolean
  acceptInput: boolean
  onActionTextInput: (text: string) => void
}

interface IState {
  filterText: string
  loading: boolean
}

export class TableBox extends React.Component<IProps, IState> {

  state: IState = {
    filterText: '',
    loading: false
  }
  outputManager: OutputManager = new OutputManager
  filterTimer: any = undefined
  isScrolled: boolean = false
  scrollToRef: any

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
    this.outputManager.setOutput(props.output, props.log)
    const {filterText} = this.state
    if(filterText.length > 0 && this.isFilterInput(filterText)) {
      this.filter(filterText)
    }
    this.forceUpdate()
  }

  appendOutput(output: ActionOutput) {
    this.outputManager.appendRows(output)
    this.setState({loading: false})
    this.scrollToBottom()
  }

  isFilterInput(text: string) : boolean {
    return !text.startsWith("/")
  }

  filter = (inputText: string) => {
    this.outputManager.filter(inputText)
    this.setState({filterText: inputText})
  }

  onFilter = (text: string) => {
    if(this.filterTimer) {
      clearTimeout(this.filterTimer)
    }
    if(text.length === 0) {
      this.outputManager.clearFilter()
      this.setState({filterText: ''})
    } else {
      this.filterTimer = setTimeout(this.filter.bind(this, text), 500)
    }
  }

  onTextInput = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value.trim()
    if(this.isFilterInput(text)) {
      this.onFilter(text)
    } else {
      this.outputManager.clearFilter()
      this.setState({filterText: text})
    }
  }

  onKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if(event.which === 13 /*Enter*/) {
      const {filterText} = this.state
      this.setState({loading: true})
      this.props.onActionTextInput(filterText.slice(1))
    }
  }

  scrollToBottom() {
    this.scrollToRef && this.scrollToRef.scrollIntoView({ behavior: "smooth" })
  }


  onScroll = (event: SyntheticEvent<HTMLDivElement>) => {
    this.isScrolled = true
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
    const {classes, compare, log} = this.props
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
        {headers.map((header, i) => {
          if(header instanceof Array){
            return(
            <TableCell key={i} style={{width: i === 0 ? '25%' : 'auto'}}>
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
            <TableCell key={i} style={{width: i === 0 ? '25%' : 'auto'}}>
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
    const {classes, acceptInput} = this.props
    const {loading} = this.state

    if(!this.outputManager.hasContent) {
      return <div/>
    }

    const rows = this.outputManager.filteredRows
    const columnCount = rows.length > 0 ? rows[0].columnCount : 1
    const inputMessage = "Enter text to filter results" + 
                        (acceptInput ? ", or /<command> to send a command" : "")
    
    return (
      <div className={classes.root}>
        <Paper  className={classes.filterContainer}>
          <Input  fullWidth disableUnderline
                  placeholder={inputMessage}
                  className={classes.filterInput}
                  onChange={this.onTextInput}
                  onKeyPress={this.onKeyPress}
          />
        </Paper>
        <Table className={classes.tableContainer}>
          <TableHead>
            {this.renderHeaderRow()}
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={columnCount} style={{width: '100%', padding: 0}}>
                {loading && <CircularProgress className={classes.loading} />}
                <div className={classes.tableBody} onScroll={this.onScroll}>
                  <Table className={classes.table}>
                    <TableBody>
                      {rows.map((row, index) => {
                        if(row.isGroupOrSubgroup) {
                          return this.renderGroupRow(row, index)
                        } else {
                          const rows : any[] = []
                          if(row.isFirstAppendedRow) {
                            rows.push(
                              <TableRow key={index+"scroll"} style={{height: 0}}>
                                <TableCell style={{height: 0, padding: 0}}>
                                  <div ref={ref => this.scrollToRef = ref}/>
                                </TableCell>
                              </TableRow>
                            )
                          }
                          rows.push(this.renderRow(row, index))
                          return rows
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