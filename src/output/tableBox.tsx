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
      <TableCell key={"textcell"+index} component="th" scope="row" colSpan={colSpan}
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
                <TableCell component="th" scope="row" colSpan={colSpan}
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
    if(this.filterText.length > 0 && this.isFilterInput(this.filterText)) {
      this.filter()
    }
    this.forceUpdate()
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

  clearFilter() {
    OutputManager.clearFilter()
    this.filterText = ''
    this.forceUpdate()
  }

  isFilterInput(text: string) : boolean {
    return !((this.props.acceptInput || this.props.allowRefresh) && text.startsWith("/"))
  }

  filter = () => {
    OutputManager.filter(this.filterText)
    this.forceUpdate()
  }

  onFilter = (text: string) => {
    if(this.filterTimer) {
      clearTimeout(this.filterTimer)
    }
    if(text.length === 0) {
      this.clearFilter()
    } else {
      this.filterTimer = setTimeout(this.filter, 500)
    }
  }

  onTextInput = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    this.filterText = text
    if(this.isFilterInput(text)) {
      this.onFilter(text)
    }
    this.forceUpdate()
  }

  onKeyDown = (event) => {
    switch(event.which) {
      case 27: /*Esc*/
        this.clearFilter()
        break
      case 13: /*Enter*/
        this.props.onActionTextInput(this.filterText.slice(1))
        break
    }
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
    OutputManager.showeHideAllGroups()
    this.forceUpdate()
  }

  onSuperGroupClick = (superGroupRow: Row) => {
    superGroupRow.children.forEach(row => {
      if(row.isGroup) {
        OutputManager.showeHideGroup(row.groupIndex)
      } else if(row.isSubGroup) {
        OutputManager.showeHideSubGroup(row.subGroupIndex)
      } else if(row.isSection) {
        OutputManager.showeHideSection(row.sectionIndex)
      }
      this.forceUpdate()
    })
  }

  onGroupClick = (groupIndex?: number) => {
    if(groupIndex) {
      OutputManager.showeHideGroup(groupIndex)
      this.forceUpdate()
    }
  }

  onSubGroupClick = (subGroupIndex?: number) => {
    if(subGroupIndex) {
      OutputManager.showeHideSubGroup(subGroupIndex)
      this.forceUpdate()
    }
  }

  onSectionClick = (sectionIndex?: number) => {
    if(sectionIndex) {
      OutputManager.showeHideSection(sectionIndex)
      this.forceUpdate()
    }
  }

  renderGroupRow(row: Row, rowIndex: number) {
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
                onClick={
                  row.isSuperGroup ? this.onSuperGroupClick.bind(this, row) :
                  row.isGroup ? this.onGroupClick.bind(this, row.groupIndex) :
                  row.isSubGroup ? this.onSubGroupClick.bind(this, row.subGroupIndex) :
                  row.isSection ? this.onSectionClick.bind(this, row.sectionIndex)
                  : undefined
                }
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
        return (
          <TextCell key={"TextCell"+ci} 
                    index={ci} 
                    cell={cell}
                    className={cellClass}
                    colSpan={ci === 0 ? gap : 1}
          />
        )
      }
    })

  }

  renderRow(row: Row, rowIndex: number, isAppendedRow: boolean) {
    const {classes, compare, health, log} = this.props
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
    components.push(
      <TableRow key={rowIndex} className={rowClass} >
        {cellContent}
      </TableRow>
    )
    components.push(
      <TableRow key={rowIndex+".space"} className={classes.tableRowSpacer}>
        <TableCell colSpan={columnCount} className={classes.tableSpacerCell} />
      </TableRow>
    )
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
          if(header instanceof Array){
            return(
            <TableCell key={i} style={{width: i===0?keyColumnWidth:'auto', paddingLeft: 10}}
                    colSpan={emptyCount === 0 ? 1 : i === 0 ? 1+emptyCount : 1} >
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
            <TableCell key={i} style={{width: i===0?keyColumnWidth:'auto', paddingLeft: 10}}
                        colSpan={emptyCount === 0 ? 1 : i === 0 ? 1+emptyCount : 1} >
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
    const {classes, acceptInput, allowRefresh} = this.props

    if(!OutputManager.hasContent) {
      return <div/>
    }

    const rows = OutputManager.filteredRows
    const columnCount = OutputManager.headers.length
    let inputMessage = "Type to filter results"
    if(acceptInput || allowRefresh) {
      inputMessage += ", or enter"
      acceptInput && (inputMessage += " /<input>")
      acceptInput && allowRefresh && (inputMessage += " or")
      allowRefresh && (inputMessage += " /r")
      inputMessage += " (enter /help to see available commands)"
    }
    let hiddenIndicatorShown = false
    let parentIsSection = false
    let isAppendedRow = false

    const groups: any[] = []
    let openParents: any[] = []
    let currentParent: {renderedRow: any[], children: any[], row?: Row, isSuperGroup?: boolean,
                        isGroup?: boolean, isSubGroup?: boolean, isSection?: boolean}

    rows.forEach((row, index) => {
      if(row.isSomeGroup) {
        hiddenIndicatorShown = false
        parentIsSection = (row.isGroup || row.isSubGroup) ? false : (parentIsSection || row.isSection)
        if(row.isSuperGroup) {
          openParents = []
          currentParent =  {renderedRow: this.renderGroupRow(row, index), children: [], row, isSuperGroup: true}
          groups.push(currentParent)
          openParents.push(currentParent)
        } else if(row.isGroup) {
          while(openParents.length > 0 && !openParents[openParents.length-1].isSuperGroup) {
            openParents.pop()
            currentParent = openParents[openParents.length-1]
          }
          const newParent = {renderedRow: this.renderGroupRow(row, index), children: [], row, isGroup: true}
          if(currentParent) {
            currentParent.children.push(newParent)
          } else {
            groups.push(newParent)
          }
          currentParent = newParent
          openParents.push(newParent)
        } else if((row.isSubGroup || row.isSection) && !row.isHidden) {
          currentParent = openParents.length > 0 ? openParents[openParents.length-1] : undefined
          while(openParents.length > 0 && !openParents[openParents.length-1].isGroup && !openParents[openParents.length-1].isSuperGroup) {
            if((row.isSection && openParents[openParents.length-1].isSection) || row.isSubGroup) {
              openParents.pop()
              currentParent = openParents.length > 0 ? openParents[openParents.length-1] : undefined
            } else {
              break
            }
          }
          const newParent = {renderedRow: this.renderGroupRow(row, index), children: [], row,
                              isSubGroup: row.isSubGroup, isSection: row.isSection}
          if(currentParent) {
            currentParent.children.push(newParent)
          } else {
            groups.push(newParent)
          }
          currentParent = newParent
          openParents.push(newParent)
        }
      } else {
        if(!currentParent) {
          currentParent =  {renderedRow: [], children: []}
          groups.push(currentParent)
        }
        if(row.isFirstAppendedRow) {
          isAppendedRow = true
          currentParent.children.push(
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
            const parent = currentParent
            currentParent.children.push(
              <TableRow key={index+"hidden"} className={classes.tableRowHidden}>
                <TableCell className={classes.tableCellHidden}
                          style={{cursor: 'pointer'}}
                          colSpan={columnCount}
                          onClick={() => parent.isSection ? this.onSectionClick(row.sectionIndex) :
                                        parent.isSubGroup ? this.onSubGroupClick(row.subGroupIndex) : 
                                        parent.isGroup ? this.onGroupClick(row.groupIndex) : undefined}
                >
                ...
                </TableCell>
              </TableRow>
            )
          }
        } else {
          currentParent.children.push(this.renderRow(row, index, isAppendedRow))
        }
      }
    })

    const renderGroup = (group, pi) => {
      let groupRows: any[] = []
      if(group.renderedRow && group.renderedRow.length > 0) {
        groupRows = groupRows.concat(group.renderedRow)
        group.children.forEach((subGroup, sgi) => {
          groupRows = groupRows.concat(renderGroup(subGroup, "g"+pi+"sg"+sgi))
        })
      } else if(group.length) {
        groupRows = groupRows.concat(group)
      } else if(group.children) {
        groupRows = groupRows.concat(group.children)
      } else {
        groupRows.push(group)
      }
      if(groupRows.length > 0) {
        return (
          <TableRow key={pi} className={classes.tableRow}>
            <TableCell colSpan={columnCount} className={classes.tableWrapperCell}>
              <Table>
                <TableBody>
                  {groupRows}
                </TableBody>
              </Table>
            </TableCell>
          </TableRow>
        )
      } else {
        return []
      }
    }
    return (
      <div className={classes.root}>
        <Paper className={classes.filterContainer}>
          <Input  fullWidth disableUnderline autoFocus
                  value={this.filterText}
                  placeholder={inputMessage}
                  className={classes.filterInput}
                  onChange={this.onTextInput}
                  onKeyDown={this.onKeyDown}
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
                      {groups.map((group, gi) => renderGroup(group, gi))}
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