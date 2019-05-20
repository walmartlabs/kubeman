import React, { ChangeEvent, KeyboardEvent, SyntheticEvent } from "react"

import { withStyles, WithStyles } from '@material-ui/core/styles'
import { Table, TableHead, TableBody, TableRow, TableCell } from "@material-ui/core";
import { Paper, Typography, InputBase, CircularProgress } from '@material-ui/core';
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
                          health: boolean, log: boolean, wide: boolean, classes: any) : string {
  let className = classes.tableCell
  if(cell.isSuperGroup || cell.isGroup) {
    className += " " + classes.tableGroupCell
  } else if(cell.isSubGroup || cell.isSection) {
    className += " " + classes.tableSubGroupCell
  } else {
    if(isKeyColumn && !wide) {
      className = className + " " + classes.tableKeyCell
    }
    if(highlight) {
      className = className + " " + (isKeyColumn ? classes.tableKeyCellHighlight : classes.tableCellHighlight)
    } 
    if(!isKeyColumn && compare) {
      className = className + " " + classes.tableCellCompare
    }
    if(health && !isKeyColumn && !compare && !cell.isMatched && cell.isHealthStatusField) {
      className = className + " " + (cell.isHealthy ? classes.tableCellHealthGood : 
                      cell.isUnhealthy ? classes.tableCellHealthBad : classes.tableCell)
    } 
  }
  if(cell.isMatched) {
    className = className + " " + classes.tableCellFiltered
  }
  return className
}

const TextCell = withStyles(styles)(({index, cell, colSpan, className, classes}: ITableCellProps) => {
  return cell.render((formattedText) => {
    return (
      <TableCell key={"textcell"+index} scope="row" colSpan={colSpan}
                className={className}
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
              <TableRow key={gridIndex} className={classes.tableCellInnerRow}>
                <TableCell scope="row" colSpan={colSpan}
                className={className}
                dangerouslySetInnerHTML={{__html:formattedText}} />
              </TableRow>
            )
          })}
        </TableBody>  
      </Table>        
      
    </TableCell>
  )
})


interface FilterInputProps extends WithStyles<typeof styles> {
  placeholder: string
  isFilterInput: (string) => boolean
  onFilter: (...any) => any
  clearFilter: () => any
  onActionTextInput: (string) => any
}

interface FilterInputState {
  filterText: string
}

const FilterInput = withStyles(styles)(
class extends React.Component<FilterInputProps, FilterInputState> {
  state: FilterInputState = {
    filterText: '',
  }

  onKeyDown = (event) => {
    const {filterText} = this.state
    switch(event.which) {
      case 27: /*Esc*/
        this.setState({filterText: ''})
        this.props.clearFilter()
        break
      case 13: /*Enter*/
        if(this.props.isFilterInput(filterText)) {
          this.props.onFilter(filterText)
        } else {
          this.props.onActionTextInput(filterText.slice(1))
        }
        break
    }
  }

  onTextInput = (event: ChangeEvent<HTMLInputElement>) => {
    const filterText = event.target.value
    if(this.props.isFilterInput(filterText)) {
      this.props.onFilter(filterText)
    }
    this.setState({filterText})
  }

  render() {
    const {placeholder, classes} = this.props
    return (
      <InputBase  fullWidth autoFocus
              value={this.state.filterText}
              placeholder={placeholder}
              className={classes.filterInput}
              onChange={this.onTextInput}
              onKeyDown={this.onKeyDown}
      />
    )
  }
})


interface IProps extends WithStyles<typeof styles> {
  output: ActionOutput
  compare: boolean
  log: boolean
  health: boolean
  acceptInput: boolean
  allowRefresh: boolean
  scrollMode: boolean
  rowLimit: number
  onActionTextInput: (text: string) => void
}

interface IState {
}

export class TableBox extends React.Component<IProps, IState> {

  state: IState = {
  }
  filterTimer: any = undefined
  lastScrollTop: number = -1
  isScrolled: boolean = false
  scrollToRef: any
  bottomRef: any
  filterText: string = ''
  loading: boolean = false

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
    this.isScrolled = false
    this.lastScrollTop = -1
    OutputManager.setOutput(props.output, props.log, props.rowLimit)
    if(this.isFilterInput(this.filterText)) {
      this.filter()
    }
  }

  appendOutput(output: ActionOutput) {
    OutputManager.appendRows(output)
    this.props.scrollMode && this.scrollToBottom()
    this.forceUpdate()
  }

  showLoading(loading: boolean) {
    this.loading = loading
    this.forceUpdate()
  }

  clearFilter = () => {
    OutputManager.clearFilter()
    this.filterText = ''
    this.forceUpdate()
  }

  isFilterInput = (filterText: string) : boolean => {
    return !((this.props.acceptInput || this.props.allowRefresh) && filterText.startsWith("/"))
  }

  filter = () => {
    if(this.filterText.length === 0) {
      this.clearFilter()
    } else {
      OutputManager.filter(this.filterText)
    }
    this.forceUpdate()
  }

  onFilter = (filterText: string) => {
    this.filterText = filterText
    if(this.filterTimer) {
      clearTimeout(this.filterTimer)
    }
    this.filterTimer = setTimeout(this.filter, 500)
  }

  scrollToBottom() {
    if(this.scrollToRef && !this.isScrolled) {
      setTimeout(() => this.scrollToRef && this.scrollToRef.scrollIntoView({behavior: 'smooth', block: 'center'}), 300)
    }
  }

  onScroll = (event) => {
    if(event.currentTarget.scrollTop < this.lastScrollTop) {
      this.isScrolled = true
    } else {
      this.isScrolled = false
    }
    this.lastScrollTop = event.currentTarget.scrollTop
  }

  onHeaderClick = () => {
    OutputManager.showeHideAllRows()
    this.forceUpdate()
  }

  onRowClick = (row: Row) => {
    OutputManager.showeHideChildren(row)
    this.forceUpdate()
  }

  renderGroupRow(row: Row, rowIndex) {
    const {classes} = this.props
    const components : any[] = []
    const columnCount = OutputManager.headers.length
    const colspans: number[] = []
    row.cells.forEach(cell => {
      cell.hasContent ? colspans.push(1) : colspans[colspans.length-1]++
    })

    if(!row.isSection) {
      components.push(
        <TableRow key={rowIndex+".pre"} className={classes.tableGroupRowSpacer}>
          <TableCell colSpan={columnCount} className={classes.tableSpacerCell}/>
        </TableRow>
      )
    }
    components.push(
      <TableRow key={rowIndex+".group"} 
                className={row.isSuperGroup ? classes.tableSuperGroupRow : 
                           row.isGroup ? classes.tableGroupRow : 
                           row.isSubGroup ? classes.tableSubgroupRow : 
                           classes.tableSectionRow }
                onClick={row && row.isSomeGroup ? this.onRowClick.bind(this, row) : undefined}
      >
        {row.cells.filter(cell => cell.hasContent)
          .map((cell,i) => {
            const cellClass = computeCellClass(cell, false, false, false, false, false, false, classes)
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
    if(!row.isSection) {
      components.push(
        <TableRow key={rowIndex+".space"} className={classes.tableRowSpacer}>
          <TableCell colSpan={columnCount} className={classes.tableSpacerCell} />
        </TableRow>
      )
    }
    return components
  }

  renderCells(row, cells, gap) {
    const {classes, compare, health, log} = this.props
    let highlight = compare ? row.columnsDiffer : false

    return cells.map((cell, ci) => {
      const isKeyColumn = !row.isNoKey && !row.isTitle && cell.isFirstColumn && row.columnCount > 1
      const cellClass = computeCellClass(cell, isKeyColumn, highlight, compare, health, log, row.isWide, classes)
      if(cell.isArray) {
        return (
          <GridCell key={"GridCell"+ci} 
                    index={ci} 
                    cell={cell}
                    className={cellClass}
                    colSpan={ci === 0 ? gap : 1}
          />
        )
      } else {
        return <TextCell key={"TextCell"+ci} 
                        index={ci} 
                        cell={cell}
                        className={cellClass}
                        colSpan={ci === 0 ? gap : 1}
              />
      }
    })

  }

  renderDataRow(row: Row, rowIndex, isAppendedRow: boolean) {
    const {classes} = this.props
    const columnCount = OutputManager.headers.length
    const components : any[] = []

    let cellContent
    if(row.isWide) {
      cellContent = (
        <TableCell colSpan={columnCount} className={classes.tableWrapperCell}>
          <Table>
            <TableBody>
              {row.subTable.map((subRow, ri) => (
                <TableRow key={"SubRow"+ri} className={classes.tableRow + " " + classes.tableCellWideRow}>
                  {this.renderCells(row, subRow, 1)}
                </TableRow>
              ))}
              </TableBody>
            </Table>
          </TableCell>
      )
    } else {
      const cellCount = row.cells.length
      const gap = columnCount - cellCount > 0 ? 1 + columnCount - cellCount : 1
      cellContent = this.renderCells(row, row.cells, gap)
    }
    const rowClass = row.isEmpty ? classes.tableEmptyRow : 
                      row.isTitle ? classes.tableTitleRow :
                      classes.tableRow + " " + (isAppendedRow && this.props.scrollMode ? classes.tableAppendedRow : "")
    row.isTitle && components.push(this.renderSpacer(rowIndex+"pretitle"))
    components.push(
      <TableRow key={rowIndex} className={rowClass} >
        {cellContent}
      </TableRow>
    )
    components.push(this.renderSpacer(rowIndex))
    return components
  }

  renderHeaderRow() {
    const {classes} = this.props
    let headers = OutputManager.headers
    const filterMatchedColumns = OutputManager.matchedColumns
    const keyColumnWidth = 'auto'
    const headersWithData = headers.filter(h => h.length > 0)
    const emptyCount = headers.length - headersWithData.length
    const showMultipleColumns = headersWithData.length > 1
    !showMultipleColumns && (headers = headersWithData)
    return (
      <TableRow className={classes.tableHeaderRow}
                onClick={this.onHeaderClick}
      >
        {headers.map((header, i) => {
          const columnMatchedFilter = filterMatchedColumns.has(i)
          return(
            <TableCell key={i} style={{width: i===0?keyColumnWidth:'auto', paddingLeft: 10}}
                    colSpan={emptyCount === 0 ? 1 : i === 0 ? 1+emptyCount : 1} >
              <Typography className={classes.tableHeaderText}>
                {(header instanceof Array) ? header.map((text,hi) => {
                  return (
                    <span key={hi} style={{display: 'block'}}>
                      {text}
                    </span>
                  )
                }) : header}
                {columnMatchedFilter && <span style={{display: 'block', fontSize: '0.7rem'}}>[filtered]</span>}
              </Typography>
            </TableCell>
          )
        })}
      </TableRow>
    )
  }

  renderSpacer(index) {
    const {classes} = this.props
    const columnCount = OutputManager.columnCount
    return (
      <TableRow key={index+".space"} className={classes.tableRowSpacer}>
        <TableCell colSpan={columnCount} className={classes.tableSpacerCell} />
      </TableRow>
    )
  }

  renderScrollPoint(index) {
    return (
      <TableRow key={index+"scroll"} style={{height: 0}}>
        <TableCell style={{height: 0, padding: 0}}>
          <div className="scrollDiv" ref={ref => this.scrollToRef = ref}/>
        </TableCell>
      </TableRow>
    )
  }

  renderHiddenIndicatorRow(index, parentRow, classes) {
    return [
      <TableRow key={index+"hidden"} className={classes.tableRowHidden}>
        <TableCell className={classes.tableCellHidden}
                  style={{cursor: 'pointer'}}
                  colSpan={OutputManager.columnCount}
                  onClick={parentRow && parentRow.isSomeGroup ? this.onRowClick.bind(this, parentRow) : undefined}
        >
        ...
        </TableCell>
      </TableRow>,
      this.renderSpacer(index)
    ]
  }

  wrapRowsInTable(rows: any[], index, classes) {
    return [
      <TableRow key={index} className={classes.tableRow}>
        <TableCell colSpan={OutputManager.columnCount} className={classes.tableWrapperCell}>
          <Table>
            <TableBody>
              {rows}
            </TableBody>
          </Table>
        </TableCell>
      </TableRow>
    ]
  }

  renderRows() {
    const {classes} = this.props
    const columnCount = OutputManager.columnCount

    const renderedRows: any[] = []
    const renderRow = (row: Row, index) => {
      const currentRows: any[] = []
      const childRows: any[] = []
      let dataChildRowCount = 0
      if(row.isVisible && row.isFirstAppendedRow && (!row.isSomeGroup || row.visibleChildCount > 0)) {
        currentRows.push(this.renderScrollPoint(index))
      }
      if(row.isSomeGroup) {
        row.isVisible && currentRows.push(...this.renderGroupRow(row, index))
        if(row.isVisible && row.hiddenChildCount > 0) {
          childRows.push(...this.renderHiddenIndicatorRow(index+"opening", row, classes))
        }
      } else {
        row.isVisible && currentRows.push(...this.renderDataRow(row, index, row.isFirstAppendedRow))
      }
      row.filteredChildren.map((childRow,ri) => {
        childRows.push(...renderRow(childRow, index+"."+ri))
        !childRow.isSomeGroup && ++dataChildRowCount
      })
      if(row.isSomeGroup && row.isVisible && dataChildRowCount > 0 && row.hiddenChildCount > 0 && row.visibleChildCount > 0) {
        childRows.push(...this.renderHiddenIndicatorRow(index+"closing", row, classes))
      }
      if(currentRows.length > 0 && row.isSomeGroup) {
        currentRows.push(...this.wrapRowsInTable(childRows, index, classes))
        return currentRows
      } else if(currentRows.length > 0) {
        return currentRows
      } else {
        return []
      }
    }

    OutputManager.topRows.forEach((row, index) => {
      renderedRows.push(...renderRow(row, index))
    })

    return renderedRows
  }

  render() {
    const {classes, acceptInput, allowRefresh} = this.props
    if(!OutputManager.hasContent) {
      return <div/>
    }

    const renderedRows = this.renderRows()

    const columnCount = OutputManager.columnCount
    let inputMessage = "Type to filter results"
    if(acceptInput || allowRefresh) {
      inputMessage += ", or enter"
      acceptInput && (inputMessage += " /<input>")
      acceptInput && allowRefresh && (inputMessage += " or")
      allowRefresh && (inputMessage += " /r")
      inputMessage += " (enter /help to see available commands)"
    }

    return (
      <div className={classes.root}>
        <Paper className={classes.filterContainer}>
          <FilterInput placeholder={inputMessage}
              isFilterInput={this.isFilterInput}
              onFilter={this.onFilter}
              clearFilter={this.clearFilter}
              onActionTextInput={this.props.onActionTextInput}
          />
        </Paper>
        <Table className={classes.tableContainer}>
          <TableHead>
            {this.renderHeaderRow()}
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={columnCount} style={{width: '100%', padding: 0}}>
                {this.loading && <CircularProgress className={classes.loading} />}
                <div className={classes.tableBody} onScroll={this.onScroll}>
                  <Table className={classes.table}>
                    <TableBody>
                      {renderedRows}
                      <TableRow style={{height: 0}}>
                        <TableCell className={classes.tableSpacerCell}>
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