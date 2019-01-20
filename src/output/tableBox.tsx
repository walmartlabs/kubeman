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
  colSpan?: number
  className: string
}

function computeCellClass(cell: Cell, isKeyColumn: boolean, highlight: boolean, compare: boolean, 
                          health: boolean, log: boolean, classes: any) : string {
  let className = classes.tableCell
  if(!cell.isGroup && !cell.isSubGroup ) {
    if(isKeyColumn) {
      className = className + " " + classes.tableKeyCell
    }
    if(highlight) {
      className = className + " " + (isKeyColumn ? classes.tableKeyCellHighlight : classes.tableCellHighlight)
    } 
    if(!isKeyColumn && compare) {
      className = className + " " + classes.tableCellCompare
    }
    if(health && !isKeyColumn && !compare && !log && cell.isHealthStatusField) {
      className = className + " " + (cell.isHealthy ? classes.tableCellHealthGood : 
                      cell.isUnhealthy ? classes.tableCellHealthBad : classes.tableCell)
    } 
  }
  return className
}

const TextCell = withStyles(styles)(({index, cell, colSpan, className, classes}: ITableCellProps) => {
  return cell.render((formattedText) => {
    return (
      <TableCell key={"textcell"+index} component="th" scope="row" colSpan={colSpan}
                className={className}
                style={{paddingLeft: cell.isGroup ? '2px' : '10px'}}
                dangerouslySetInnerHTML={{__html:formattedText}} />
    )})
})

const GridCell = withStyles(styles)(({index, cell, colSpan, className, classes}: ITableCellProps) => {
  return (
    <TableCell key={"gridcell"+index} component="th" scope="row" colSpan={colSpan}
              className={className}
              style={{paddingLeft: 2, paddingRight: 2}} >
      <Table>
        <TableBody>
          {cell.render((formattedText, gridIndex) => {
            return (
              <TableRow key={gridIndex} className={classes.tableCellInnerRow + " gridRow"}>
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
  compare: boolean
  log: boolean
  health: boolean
  acceptInput: boolean
  scrollMode: boolean
  onActionTextInput: (text: string) => void
}

interface IState {
  filterInput: string
  loading: boolean
}

export class TableBox extends React.Component<IProps, IState> {

  state: IState = {
    filterInput: '',
    loading: false
  }
  outputManager: OutputManager = new OutputManager
  filterTimer: any = undefined
  isScrolled: boolean = false
  scrollToRef: any
  bottomRef: any
  filterText: string = ''

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
    this.outputManager.setOutput(props.output, props.log)
    if(this.filterText.length > 0 && this.isFilterInput(this.filterText)) {
      this.filter()
    }
    this.setState({filterInput: this.filterText})
    this.forceUpdate()
  }

  appendOutput(output: ActionOutput) {
    this.outputManager.appendRows(output)
    this.props.scrollMode && this.scrollToBottom()
    this.forceUpdate()
  }

  showLoading(loading: boolean) {
    this.setState({loading})
  }

  clearFilter() {
   this.outputManager.clearFilter()
   this.filterText = ''
   this.forceUpdate()
  }

  isFilterInput(text: string) : boolean {
    return !this.props.acceptInput || !text.startsWith("/")
  }

  filter = () => {
    this.outputManager.filter(this.filterText)
    this.forceUpdate()
  }

  onFilter = (text: string) => {
    if(this.filterTimer) {
      clearTimeout(this.filterTimer)
    }
    if(text.length === 0) {
      this.clearFilter()
    } else {
      this.filterText = text
      this.filterTimer = setTimeout(this.filter, 500)
    }
  }

  onTextInput = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    if(this.isFilterInput(text)) {
      this.onFilter(text)
    } else {
      this.outputManager.clearFilter()
    }
    this.setState({filterInput: text})
  }

  onKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if(event.which === 13 /*Enter*/) {
      const {filterInput} = this.state
      this.props.onActionTextInput(filterInput.slice(1))
    }
  }

  scrollToBottom() {
    if(this.scrollToRef) {
      setTimeout(() => this.scrollToRef && this.scrollToRef.scrollIntoView({behavior: 'smooth', block: 'center'}), 300)
    }
  }


  onScroll = (event: SyntheticEvent<HTMLDivElement>) => {
    this.isScrolled = true
  }

  onGroupClick = (groupIndex?: number) => {
    if(groupIndex) {
      this.outputManager.showeHideGroup(groupIndex)
      this.forceUpdate()
    }
  }

  renderGroupRow(row: Row, rowIndex: number) {
    const {classes} = this.props
    const components : any[] = []
    const colspans: number[] = []
    row.cells.forEach(cell => {
      cell.hasContent ? colspans.push(1) : colspans[colspans.length-1]++
    })

    rowIndex > 0 && components.push(
      <TableRow key={rowIndex+".pre"} className={classes.tableGroupRow}>
      </TableRow>
    )
    components.push(
      <TableRow key={rowIndex+".group"} 
                className={row.isGroup ? classes.tableGroupRow : classes.tableSubgroupRow}
                onClick={this.onGroupClick.bind(this, row.isGroup ? row.groupIndex : undefined)}
      >
        {row.cells.filter(cell => cell.hasContent)
          .map((cell,i) => {
            const cellClass = computeCellClass(cell, false, false, false, false, false, classes)
            return (
              <TextCell key={"GroupCell"+i}
                index={i}
                cell={cell}
                className={cellClass}
                colSpan={colspans[i]}
              />
            )
          })
        }
      </TableRow>
    )
    return components
  }

  renderRow(row: Row, rowIndex: number, isAppendedRow: boolean) {
    const {classes, compare, health, log} = this.props
    let highlight = compare ? row.lastTwoColumnsDiffer : false
    const components : any[] = []
    components.push(
      <TableRow key={rowIndex} 
                className={classes.tableRow + " " + 
                (isAppendedRow && this.props.scrollMode ? classes.tableAppendedRow : "")} >
      {row.cells.map((cell, ci) => {
        const isKeyColumn = cell.isFirstColumn && row.columnCount > 1
        const cellClass = computeCellClass(cell, isKeyColumn, highlight, compare, health, log, classes)
        if(cell.isArray) {
          return (
            <GridCell key={"GridCell"+ci} 
                      index={ci} 
                      cell={cell}
                      className={cellClass}
            />
          )
        } else {
          return (
            <TextCell key={"TextCell"+ci} 
                      index={ci} 
                      cell={cell}
                      className={cellClass}
                      colSpan={1}
            />
          )
        }
      })}
      </TableRow>
    )
    components.push(
      <TableRow key={rowIndex+".space"} className={classes.tableRowSpacer}>
      </TableRow>
    )
    return components
  }

  renderHeaderRow() {
    const {classes} = this.props
    const headers = this.outputManager.headers
    const filterMatchedColumns = this.outputManager.matchedColumns
    return (
      <TableRow className={classes.tableHeaderRow}>
        {headers.map((header, i) => {
          const columnMatchedFilter = filterMatchedColumns.has(i)
          if(header instanceof Array){
            return(
            <TableCell key={i} style={{width: i === 0 ? '25%' : 'auto'}}>
              <Typography className={classes.tableHeaderText}>
              {header.map((text,hi) =>
                <span key={hi} style={{display: 'block'}}>
                  {text}
                </span>
              )}
              {columnMatchedFilter && 
                <span style={{display: 'block', fontSize: '0.7rem'}}>[matches]</span>}
              </Typography>
            </TableCell>
            )
          } else {
            return(
            <TableCell key={i} style={{width: i === 0 ? '25%' : 'auto', textAlign: 'center'}}>
              <Typography className={classes.tableHeaderText}>
                {header} 
                {columnMatchedFilter && 
                  <span style={{display: 'block', fontSize: '0.7rem'}}>[matches]</span>}
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
    const columnCount = this.outputManager.headers.length
    const inputMessage = "Enter text to filter results" + 
                        (acceptInput ? ", or /<command> to send a command" : "")
    let hiddenIndicatorShown = false
    let parentIsGroup = false
    let isAppendedRow = false

    return (
      <div className={classes.root}>
        <Paper  className={classes.filterContainer}>
          <Input  fullWidth disableUnderline
                  value={this.state.filterInput}
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
                          hiddenIndicatorShown = false
                          parentIsGroup = row.isGroup && !row.isSubGroup
                          return this.renderGroupRow(row, index)
                        } else {
                          const tableRows : any[] = []
                          if(row.isFirstAppendedRow) {
                            isAppendedRow = true
                            tableRows.push(
                              <TableRow key={index+"scroll"} style={{height: 0}}>
                                <TableCell style={{height: 0, padding: 0}}>
                                  <div className="scrollDiv" ref={ref => this.scrollToRef = ref}/>
                                </TableCell>
                              </TableRow>
                            )
                          }
                          if(row.isHidden) {
                            if(!hiddenIndicatorShown) {
                              hiddenIndicatorShown = true
                              tableRows.push(
                                <TableRow key={index+"hidden"} style={{height: 30}}>
                                  <TableCell className={classes.tableCellHidden}
                                            style={{cursor: parentIsGroup ? 'pointer' : 'inherit'}}
                                            colSpan={columnCount}
                                            onClick={() => parentIsGroup && this.onGroupClick(row.groupIndex)}
                                  >
                                  ...
                                  </TableCell>
                                </TableRow>
                              )
                            }
                          } else {
                            tableRows.push(this.renderRow(row, index, isAppendedRow))
                          }
                          return tableRows
                        }
                      })}
                      <TableRow style={{height: 0}}>
                        <TableCell style={{height: 0, padding: 0}}>
                          <div className="bottomDiv" ref={ref => this.bottomRef = ref}/>
                        </TableCell>
                      </TableRow>
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