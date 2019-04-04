import { ActionOutput } from "../actions/actionSpec"
import _ from 'lodash'
import yaml from 'json-to-pretty-yaml'
import hljs from 'highlight.js/lib/highlight'
import yamlHighlight from 'highlight.js/lib/languages/yaml'
import 'highlight.js/styles/github.css'

import StringBuffer from '../util/stringbuffer'
import {appTheme} from '../theme/theme'
import jsonUtil from '../util/jsonUtil'

const healthStatusHeaderKeywords = ["status", "health", "condition"]

const healthyKeywords : string[] = [
  "active", "healthy", "good", "running", "started", "starting", "restarted", "success", 
  "complete", "created", "available", "ready", "normal", "reachable", "permitted", "correct"
]
const unhealthyKeywords : string[] = [
  "inactive", "unhealthy", "bad", "stop", "terminated", "terminating", "wait", "conflict",
  "warning", "error", "fail", "not available", "unavailable", "unable", "unreachable", "incorrect", "mismatch"
]

const healthyIgnoreKeywords: string[] = [
  "maxunavailable"
]

const unhealthyIgnoreKeywords: string[] = [
  "maxunavailable", "unavailable:"
]

hljs.registerLanguage('yaml', yamlHighlight)

function applyHighlight(text: string, filters: string[]) : [string, boolean] {
  const highlightColor = appTheme.activeTheme.palette && 
          appTheme.activeTheme.palette.type === 'dark' ? '#804d00' : '#FFCC80'

  const lowerText = text.toLowerCase()
  const matchPositions : Set<number> = new Set
  let cellChanged = false
  filters.forEach(filter => {
    let index = 0
    if(filter.length > 0) {
      while((index = lowerText.indexOf(filter, index)) >= 0) {
        for(let i = index; i < index + filter.length; i++ ) {
          matchPositions.add(i)
        }
        index += filter.length
      }
    }
  })
  const positions = Array.from(matchPositions.values()).sort((a,b) => a-b)
  let startPos = -1, endPos = -1
  const sb = new StringBuffer
  positions.forEach(i => {
    if(startPos < 0) {
      startPos = i
      endPos = i
      sb.append(text.slice(0,i))
    } else if(i === endPos+1) {
      endPos = i
    } else {
      let highlightedText = "<span style='color: #000; background-color:" + highlightColor + "'>" 
                            + text.slice(startPos, endPos+1) 
                            + "</span>"
      sb.append(highlightedText)
      sb.append(text.slice(endPos+1,i))
      startPos = i
      endPos = i
      cellChanged = true
    }
  })
  if(startPos >= 0) {
    let highlightedText = "<span style='color: #000; background-color:" + highlightColor + "'>" 
                          + text.slice(startPos, endPos+1) 
                          + "</span>"
    sb.append(highlightedText)
    cellChanged = true
  }
  sb.append(text.slice(endPos+1))
  return [sb.toString(), cellChanged]
}

export type ContentRenderer = (formattedContent: string, index: number) => any


export type CellContent = string|Array<any>|Object

export class Cell {
  index: number
  isArray: boolean = false
  isJSON: boolean = false
  isText: boolean = false
  isLog: boolean = false
  isGroup: boolean = false
  isSubGroup: boolean = false  
  isSection: boolean = false
  isHealthStatusField: boolean = false
  isMatched: boolean = false
  isFiltered: boolean = false

  private content: CellContent
  private formattedContent: CellContent
  private filteredIndexes: number[] = []
  private stringContent: string = ''
  
  constructor(content: CellContent, index:number, formattedContent?: CellContent, 
              appliedFilters?: string[],
              isGroup?: boolean, isSubGroup?: boolean, isSection?: boolean,
              isHealthStatusField?: boolean, isLog?: boolean) {
    this.index = index
    this.isText = jsonUtil.isText(content)
    this.isArray = jsonUtil.isArray(content)
    this.isJSON = jsonUtil.isObject(content)
    this.isLog = isLog || false
    if(this.isText && (this.isArray || this.isJSON)) {
      try {
        content = JSON.parse(content as string)
        this.isText = false
      } catch(error) {
        this.isArray = this.isJSON = false
      }
    }
    this.content = content
    if(formattedContent) {
      this.formattedContent = formattedContent
    } else {
      this.formattedContent = content
    }
        
    if(this.isJSON) {
      this.formattedContent = jsonUtil.isObject(this.formattedContent) ? 
                              yaml.stringify(this.formattedContent) : this.formattedContent.toString()
      this.stringContent = (this.formattedContent as string).toLowerCase()
    } else if(this.isArray) {
      this.formattedContent = (this.formattedContent as any[]).map(item =>
         (jsonUtil.isObject(item) || jsonUtil.isArray(item)) ? yaml.stringify(item) : item.toString())
      this.stringContent = (this.formattedContent as any[])
          .map(item => JSON.stringify(item)).join(" ").toLowerCase()
    } else {
      this.formattedContent = this.formattedContent ? this.formattedContent.toString() : ""
      this.stringContent = (this.formattedContent as string).toLowerCase()
    }

    if(appliedFilters && appliedFilters.length > 0) {
      this.isFiltered = true
      appliedFilters && this.match(appliedFilters)
    }
    this.isGroup = isGroup || false
    this.isSubGroup = isSubGroup || false
    this.isSection = isSection || false
    this.isHealthStatusField = isHealthStatusField || false
  }

  match(filters: string[]) : string[] {
    const appliedFilters : string[] = []
    this.isMatched = false
    this.filteredIndexes = []
    filters.map(filter => {
      if(this.isArray) {
        (this.content as any[]).forEach((item,index) => {
          item = JSON.stringify(item).toLowerCase()
          if(item.includes(filter)) {
            if(!this.filteredIndexes.includes(index)) {
              this.filteredIndexes.push(index)
            }
          }
        })
        if(this.filteredIndexes.length > 0) {
          this.isMatched = true
          appliedFilters.push(filter)
        }
      } else if(this.stringContent.includes(filter)) {
        appliedFilters.push(filter)
        this.isMatched = true
      }
    })
    return appliedFilters
  }

  clearFilter() {
    this.filteredIndexes = []
    this.isMatched = false
  }

  highlight(filters: string[]) : [CellContent, boolean] {
    if(this.isText) {
      return applyHighlight(this.content as string, filters)
    } else if(this.isArray) {
      const changedCellData : Array<[string, boolean]> = []
      let cellChanged = false
      const arrayContent = this.content as []
      arrayContent.forEach((item,i) => {
        const isJSON = jsonUtil.isObject(item) || jsonUtil.isArray(item)
        changedCellData[i] = applyHighlight(isJSON ? yaml.stringify(item) : item, filters)
        cellChanged = cellChanged || changedCellData[i][1]
      })
      if(cellChanged) {
        let newCellContent : string[] = []
        changedCellData.forEach((data, i) => newCellContent.push(data[0]))
        return [newCellContent, true]
      }
    } else if(this.isJSON) {
      const changedCellData = applyHighlight(yaml.stringify(this.content), filters)
      return changedCellData
    }
    return [this.content, false]
  }

  formatText(text: any, isJSON: boolean) {
    if(isJSON) {
      text = "<pre>" + (this.isFiltered ? text : hljs.highlightAuto(text).value) + "</pre>"
    } else if(this.isLog) {
      text = "<pre>" + text + "</pre>"
    }
    return text
  }

  render(renderer: ContentRenderer) : any {
    if(this.isArray) {
      const indexes =  this.filteredIndexes.length > 0 ? this.filteredIndexes : (this.content as any[]).map((item,i) => i)
      return indexes.map(i => {
              return renderer(this.formatText(this.formattedContent[i], 
                              jsonUtil.isObject(this.content[i]) || jsonUtil.isArray(this.content[i])), i)
        })
    } else {
      return renderer((this.isGroup || this.isSubGroup || this.isSection) ? this.groupText 
                      : this.formatText(this.formattedContent, this.isJSON), 0)
    }
  }

  get groupText() {
    let text = this.isText ? this.formattedContent as string : ""
    if(this.isGroup && text.charAt(0) === '>') {
      text = text.slice(1)
    } else if(this.isSubGroup && text.substring(0,2) === '>>') {
      text = text.slice(2)
    } else if(this.isSection && text.substring(0,3) === '>>>') {
      text = text.slice(3)
    }
    return text
  }

  matches(otherCell: Cell) {
    return this.stringContent.localeCompare(otherCell.stringContent) === 0
  }

  get isHealthy() {
    return healthyKeywords.filter(word => this.stringContent.includes(word)).length > 0
          && healthyIgnoreKeywords.filter(word => this.stringContent.includes(word)).length == 0
          && !this.isUnhealthy
  }

  get isUnhealthy() {
    return unhealthyKeywords.filter(word => this.stringContent.includes(word)).length > 0
            && unhealthyIgnoreKeywords.filter(word => this.stringContent.includes(word)).length == 0
  }

  get isFirstColumn() {
    return this.index === 0 && !this.isGroup
  }

  get hasContent() {
    return this.content && this.content.toString().length > 0
  }

  toString() {
    return this.formattedContent.toString()
  }
}

export class Row {
  index: number
  cells: Cell[] = []
  isLog: boolean = false
  isFirstAppendedRow: boolean = false
  groupIndex: number = 0
  subGroupIndex: number = 0
  sectionIndex: number = 0
  children: Row[] = []
  isEmpty: boolean = false
  isHidden: boolean = false
  isMatched: boolean = false
  matchedColumns: Set<number> = new Set
  columnsDiffer: boolean = false
  headersCount: number = 0

  private content: CellContent[]
  private healthColumnIndex?: number
  private firstColumn?: Cell
  private appliedFilters: string[] = []
  private _isGroup: boolean = false
  private _isSubgroup: boolean = false
  private _isSection: boolean = false

  constructor(index: number, content: CellContent[], 
              groupIndex: number, subGroupIndex: number, sectionIndex: number,
              headersCount: number, healthColumnIndex?: number, isLog?: boolean, 
              formattedContent?: CellContent[], appliedFilters?: string[]) {
    this.index = index
    this.content = content
    this.groupIndex = groupIndex
    this.subGroupIndex = subGroupIndex
    this.sectionIndex = sectionIndex
    this.headersCount = headersCount
    this.isLog = isLog || false 
    this.appliedFilters = appliedFilters || []
    if(!(content instanceof Array)) {
      content = [content]
    }
    this.isEmpty = !content || content.length === 0 || content.filter(c => c && c.toString().length > 0).length === 0
    if(!this.isEmpty) {
      this._isSection = content[0].toString().startsWith(">>>") || false
      this._isSubgroup = !this._isSection && content[0].toString().startsWith(">>") || false
      this._isGroup = !this._isSection && !this._isSubgroup && content[0].toString().startsWith(">") || false
      if(this.isGroupOrSubgroupOrSection && content.length < headersCount) {
        for(let i = content.length; i < headersCount; i++) {
          content.push("")
        }
      }
      this.cells = content.map((cellContent, cellIndex) => 
        new Cell(cellContent, cellIndex,  
          formattedContent ? formattedContent[cellIndex] : undefined,
          this.appliedFilters,
          this.isGroup, this.isSubGroup, this._isSection,
          healthColumnIndex ? healthColumnIndex === cellIndex : false,
          isLog || false
          ))
          
      this.healthColumnIndex = healthColumnIndex
      this.firstColumn = this.cells.length > 0 ? this.cells[0] : undefined
      this.checkColumnsDiffer()
    }
  }

  private checkColumnsDiffer() {
    const colCount = this.cells.length
    const baseCell = this.cells[colCount-1]
    this.columnsDiffer = false
    for(let i = colCount-2; i > 0; i--) {
      if(!baseCell.matches(this.cells[i])) {
        this.columnsDiffer = true
        return
      }
    }
  }

  get isGroupOrSubgroupOrSection() : boolean {
    return this._isGroup || this._isSubgroup || this._isSection
  }

  get isGroup() : boolean {
    return this._isGroup && !this._isSubgroup
  }

  get isSubGroup() : boolean {
    return this._isSubgroup && !this._isGroup
  }

  get isSection() : boolean {
    return this._isSection
  }

  get groupText() : string {
    return this.firstColumn ? this.firstColumn.groupText : ""
  }

  get columnCount() {
    return this.cells.length
  }

  clearFilter() {
    this.isHidden = false
    this.isMatched = false
    this.appliedFilters = []
    this.matchedColumns.clear()
    this.cells.forEach(cell => cell.clearFilter())
  }

  filter(filterGroups: string[][]) : boolean {
    const matchedFilters : Set<String> = new Set
    this.appliedFilters = []
    this.isMatched = false
    if(this.isGroupOrSubgroupOrSection) {
      filterGroups.forEach(filters => {
        this.cells[0].match(filters).forEach(filter => matchedFilters.add(filter))
        const rowMatched = matchedFilters.size === filters.length
        if(rowMatched) {
          this.appliedFilters = this.appliedFilters.concat(filters).filter(filter => filter.length > 0)
          this.isMatched = true
        }
      })
      return true
    } else {
      this.matchedColumns.clear()
      filterGroups.forEach(filters => {
        this.cells.map(cell => cell.match(filters)).forEach(matchingFilters => 
                        matchingFilters.forEach(filter => matchedFilters.add(filter)))
        const rowMatched = matchedFilters.size === filters.length
        if(rowMatched) {
          this.appliedFilters = this.appliedFilters.concat(filters).filter(filter => filter.length > 0)
          this.cells.forEach((cell, index) => cell.isMatched && this.matchedColumns.add(index))
          this.isMatched = true
        }
      })
      return this.isMatched
    }
  }

  highlightFilters() : [Row, boolean] {
    const formattedCellContent : CellContent[] = []
    let rowChanged = false
    this.cells.forEach((cell, i) => {
      const newCellData = cell.highlight(this.appliedFilters)
      formattedCellContent.push(newCellData[0])
      rowChanged = rowChanged || newCellData[1]
    })
    if(rowChanged) {
      return [new Row(this.index, this.content, this.groupIndex, this.subGroupIndex, 
                      this.sectionIndex, this.headersCount, this.healthColumnIndex,
                      this.isLog, formattedCellContent, this.appliedFilters), true]
    } else {
      return [this, false]
    }
  }
}

export default class OutputManager {
  headers: any[] = []
  rows: Row[] = []
  filteredRows: Row[] = []
  matchedColumns: Set<number> = new Set

  private healthColumnIndex: number = -1
  private appliedFilters: string[][] = []
  private isLog: boolean = false
  private groupCount: number = 0
  private subGroupCount: number = 0
  private sectionCount: number = 0

  private lastGroupRow?: Row
  private lastSubGroupRow?: Row
  private lastSectionRow?: Row
  private lastGroupVisibleCount: number = 0
  private lastSubGroupVisibleCount: number = 0
  private lastSectionVisibleCount: number = 0

  setOutput(output: ActionOutput, isLog: boolean) {
    this.clearContent()
    this.isLog = isLog || false
    this.headers = output && output.length > 0 ? output.slice(0, 1)[0] : []
    this.identifyHealthColumn()
    this.groupCount = 0
    this.subGroupCount = 0
    this.sectionCount = 0
    let currentGroup, currentSubGroup, currentSection
    this.rows = 
      output && output.length > 0 ? 
        output.slice(1).map((content, rowIndex) => {
          const row = new Row(rowIndex, content, this.groupCount, this.subGroupCount, this.sectionCount, 
                                  this.headers.length, this.healthColumnIndex, this.isLog)
          if(row.isGroup) {
            currentGroup = row
            row.groupIndex = ++this.groupCount
          } else if(row.isSubGroup) {
            currentSubGroup = row
            row.subGroupIndex = ++this.subGroupCount
          } else if(row.isSection) {
            currentSection = row
            row.sectionIndex = ++this.sectionCount
          } else {
            currentGroup && currentGroup.children.push(row)
            currentSubGroup && currentSubGroup.children.push(row)
            currentSection && currentSection.children.push(row)
          }
          return row
        }) : []
    this.filteredRows = this.rows.concat()
  }

  appendRows(rows: ActionOutput) {
    let lastRowIndex = this.rows.length-1
    this.rows.forEach(row => row.isFirstAppendedRow = false)
    let isFirstAppendedRow = false
    let currentGroup, currentSubGroup, currentSection
    rows.forEach(rowContent => {
      lastRowIndex++
      const row = new Row(lastRowIndex, rowContent, this.groupCount, this.subGroupCount, this.sectionCount,
                                this.headers.length, this.healthColumnIndex, this.isLog)
      if(row.isGroup) {
        currentGroup = row
        row.groupIndex = ++this.groupCount
      } else if(row.isSubGroup) {
        currentSubGroup = row
        row.subGroupIndex = ++this.subGroupCount
      } else if(row.isSection) {
        currentSection = row
        row.sectionIndex = ++this.sectionCount
      } else {
        currentGroup && currentGroup.children.push(row)
        currentSubGroup && currentSubGroup.children.push(row)
        currentSection && currentSection.children.push(row)
      }
      this.rows.push(row)
      if(!isFirstAppendedRow) {
        row.isFirstAppendedRow = isFirstAppendedRow = true
      }
      if(this.appliedFilters.length === 0) {
        this.filteredRows.push(row)
      } else if(row.filter(this.appliedFilters)) {
        this.reprocessFilteredRow(row)
        this.lastGroupRow && this.showeHideParentRow(this.lastGroupRow, this.lastGroupVisibleCount)
        this.lastSubGroupRow && this.showeHideParentRow(this.lastSubGroupRow, this.lastSubGroupVisibleCount)
        this.lastSectionRow && this.showeHideParentRow(this.lastSectionRow, this.lastSectionVisibleCount)
        if(row.isMatched) {
          row.matchedColumns.forEach(index  => this.matchedColumns.add(index))
          this.filteredRows = this.rows.filter(row => row.isMatched)
          this.highlightFilter()
        }
      }
    })
  }

  clearContent() {
    this.appliedFilters = this.headers = this.rows = this.filteredRows = []
    this.healthColumnIndex = -1
    this.matchedColumns.clear()
    this.isLog = false
    this.groupCount = this.subGroupCount = this.sectionCount = 0
    this.lastGroupRow = undefined
    this.lastSubGroupRow = undefined
    this.lastSectionRow = undefined
    this.lastGroupVisibleCount = this.lastSubGroupVisibleCount = this.lastSectionVisibleCount = 0
  }

  private identifyHealthColumn() {
    if(this.headers.length > 0) {
      this.headers.map(header => 
        header instanceof Array ? header.map(item => item.toLowerCase()).join(" ") :
           header.toString().toLowerCase())
        .forEach((header,index) => {
          const isHealthKeywordFound = healthStatusHeaderKeywords.map(word => header.includes(word))
                                          .reduce((v1,v2) => v1 || v2)
          this.healthColumnIndex = isHealthKeywordFound ? index : this.headers.length-1
        })
    }
  }

  clearFilter() {
    this.appliedFilters = []
    this.rows.forEach(row => row.clearFilter())
    this.filteredRows = this.rows.concat()
    this.matchedColumns.clear()
    this.groupCount = this.subGroupCount = this.sectionCount = 0
    this.lastGroupRow = undefined
    this.lastSubGroupRow = undefined
    this.lastSectionRow = undefined
    this.lastGroupVisibleCount = this.lastSubGroupVisibleCount = this.lastSectionVisibleCount = 0
  }

  get hasContent() {
    return this.headers.length > 0 || this.rows.length > 0
  }

  get hasFilteredContent() {
    return this.filteredRows && this.filteredRows.length > 0
  }

  filter = (inputText: string) => {
    inputText = inputText.toLowerCase().trim()
    inputText = inputText.endsWith(" or") ? inputText.slice(0, inputText.length-2) : inputText
    const filters : string[][] = 
                  inputText.split(" or ")
                  .filter(group => group.length > 0)
                  .map(group => group.trim().split(" ").filter(word => word.trim().length > 0))
                  .filter(word => word.length > 0)

    this.clearFilter()
    if(filters.length > 0) {
      this.appliedFilters = filters
      const filteredRows = this.rows.filter(row => row.filter(filters))
      filteredRows.forEach(row => this.reprocessFilteredRow(row))
      this.lastGroupRow && this.showeHideParentRow(this.lastGroupRow, this.lastGroupVisibleCount)
      this.lastSubGroupRow && this.showeHideParentRow(this.lastSubGroupRow, this.lastSubGroupVisibleCount)
      this.lastSectionRow && this.showeHideParentRow(this.lastSectionRow, this.lastSectionVisibleCount)
      this.filteredRows = this.rows.filter(row => row.isMatched)
      this.highlightFilter()
    }
  }

  private reprocessFilteredRow(row: Row) {
    row.matchedColumns.forEach(index  => this.matchedColumns.add(index))
    if(row.isGroup) {
      this.lastGroupRow && this.showeHideParentRow(this.lastGroupRow, this.lastGroupVisibleCount)
      this.lastGroupRow = row
      this.lastGroupVisibleCount = 0
    } else if(row.isSubGroup) {
      this.lastSubGroupRow && this.showeHideParentRow(this.lastSubGroupRow, this.lastSubGroupVisibleCount)
      this.lastSubGroupRow = row
      this.lastSubGroupVisibleCount = 0
    } else if(row.isSection) {
      this.lastSectionRow && this.showeHideParentRow(this.lastSectionRow, this.lastSectionVisibleCount)
      this.lastSectionRow = row
      this.lastSectionVisibleCount = 0
    } else if(row.isMatched) {
      this.lastGroupRow && this.lastGroupVisibleCount++
      this.lastSubGroupRow && this.lastSubGroupVisibleCount++
      this.lastSectionRow && this.lastSectionVisibleCount++
    }
  }

  private showeHideParentRow(parentRow, visibleCount) {
    if(visibleCount > 0) {
      parentRow.isMatched = true
    } else if(parentRow.isMatched) {
      parentRow.children.forEach(c => {
        c.isMatched = true
        c.isHidden = true
      })
    }
  }

  private highlightFilter() {
    this.filteredRows.forEach((row,i) => {
      const [highlightedRow, rowChanged] = row.highlightFilters()
      if(rowChanged) {
        this.filteredRows[i] = highlightedRow
      }
    })
  }

  getRowsForGroup(groupIndex: number) {
    return this.rows.filter(row => row.groupIndex === groupIndex)
  }

  getRowsForSubGroup(subGroupIndex: number) {
    return this.rows.filter(row => row.subGroupIndex === subGroupIndex)
  }

  showeHideGroup(groupIndex: number) {
    let anyHidden: boolean = false
    let anyVisible: boolean = false
    this.filteredRows.filter(row => row.groupIndex === groupIndex)
      .filter((row,index) => index > 0 && !row.isSubGroup)
      .map(row => {
        anyHidden = anyHidden || row.isHidden
        anyVisible = anyVisible || !row.isHidden
        return row
      })
      .forEach(row => {
        row.isHidden = (anyVisible && anyHidden) ? false : !row.isHidden
      })
  }

  showeHideSubGroup(subGroupIndex: number) {
    this.filteredRows.filter(row => row.subGroupIndex === subGroupIndex)
      .filter((row,index) => index > 0)
      .forEach(row => row.isHidden = !row.isHidden)
  }
}