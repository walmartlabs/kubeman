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
          appTheme.activeTheme.palette.type === 'dark' ? '#FF7788' : '#FFCC80'

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
  isSuperGroup: boolean = false
  isGroup: boolean = false
  isSubGroup: boolean = false  
  isSection: boolean = false
  isHealthStatusField: boolean = false
  isMatched: boolean = false
  isFiltered: boolean = false
  content: CellContent

  private formattedContent: CellContent
  private filteredIndexes: number[] = []
  private stringContent: string = ''
  
  constructor(content: CellContent, index:number, formattedContent?: CellContent, 
              appliedFilters?: string[],
              isSuperGroup?: boolean, isGroup?: boolean, isSubGroup?: boolean, isSection?: boolean,
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
    this.isSuperGroup = isSuperGroup || false
    this.isGroup = isGroup || false
    this.isSubGroup = isSubGroup || false
    this.isSection = isSection || false
    this.isHealthStatusField = isHealthStatusField || false
  }

  match(filters: string[]) : any[] {
    const appliedFilters: Set<string> = new Set
    this.isMatched = false
    this.filteredIndexes = []
    let negated = false
    let isExcluded = false;
    filters.map(filter => {
      const isNot = filter === "!"
      negated = negated || isNot
      if(!isNot) {
        if(this.isArray) {
          (this.content as any[]).forEach((item,index) => {
            item = JSON.stringify(item).toLowerCase()
            const isMatched = item.includes(filter)
            isExcluded = isExcluded || negated && isMatched
            if(!isExcluded && (negated && !isMatched || !negated && isMatched)) {
              negated && appliedFilters.add("!")
              appliedFilters.add(filter)
              if(!this.filteredIndexes.includes(index)) {
                this.filteredIndexes.push(index)
              }
            }
          })
          this.isMatched = !isExcluded && this.filteredIndexes.length > 0
        } else {
          const isMatched = this.stringContent.includes(filter)
          isExcluded = isExcluded || negated && isMatched
          if(!isExcluded && (negated && !isMatched || !negated && isMatched)) {
            negated && appliedFilters.add("!")
            appliedFilters.add(filter)
            this.isMatched = true
          }
        }
      }
    })
    return isExcluded ? [true, []] : [false, Array.from(appliedFilters)]
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
    if(text.startsWith("##")) {
      text = text.slice(2)
    }
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
      return renderer((this.isSuperGroup || this.isGroup || this.isSubGroup || this.isSection) ? this.groupText 
                      : this.formatText(this.formattedContent, this.isJSON), 0)
    }
  }

  get groupText() {
    let text = this.isText ? this.formattedContent as string : ""
    if(this.isGroup && text.startsWith('>')) {
      text = text.slice(1)
    } else if(this.isSubGroup && text.startsWith('>>')) {
      text = text.slice(2)
    } else if(this.isSection && text.startsWith('>>>')) {
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
    return this.index === 0 && !this.isGroup && !this.isSuperGroup
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
  subTable: Cell[][] = []
  isLog: boolean = false
  isFirstAppendedRow: boolean = false
  groupIndex: number = 0
  subGroupIndex: number = 0
  sectionIndex: number = 0
  parent?: Row = undefined
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
  private _isSuperGroup: boolean = false
  private _isGroup: boolean = false
  private _isSubgroup: boolean = false
  private _isSection: boolean = false
  private _isTitle: boolean = false
  private _isWide: boolean = false
  private _isNoKey: boolean = false

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
      if((typeof content[0] === 'string' && content[0].toString().startsWith("##")) ||
        (content[0] instanceof Array && (content[0] as []).length > 0 && content[0][0].toString().startsWith("##"))) {
        this._isWide = true
      }
      this._isSuperGroup = content[0].toString().startsWith("^^") || false
      this._isTitle = content[0].toString().startsWith("++") || false
      this._isNoKey = content[0].toString().startsWith("<<") || false
      if(this.isSomeGroup && content.length < headersCount) {
        for(let i = content.length; i < headersCount; i++) {
          content.push("")
        }
      }
      if(this._isWide) {
        const subTable = content as any[][]
        this.subTable = subTable.map((subRow, subRowIndex) => subRow.map((cellContent, cellIndex) =>
          new Cell(cellContent, subRowIndex+cellIndex,
            formattedContent ? formattedContent[subRowIndex][cellIndex] : undefined,
            this.appliedFilters, false, false, false, false, false, isLog || false))
        )
      } else {
        this.cells = content.map((cellContent, cellIndex) => 
          new Cell(cellContent, cellIndex,  
            formattedContent ? formattedContent[cellIndex] : undefined,
            this.appliedFilters, this.isSuperGroup,
            this.isGroup, this.isSubGroup, this._isSection,
            healthColumnIndex ? healthColumnIndex === cellIndex : false,
            isLog || false
            ))
      }
      if(this._isSuperGroup || this._isNoKey || this._isTitle) {
        this.cells.shift()
      }
          
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

  get isSomeGroup() : boolean {
    return this._isSuperGroup || this._isGroup || this._isSubgroup || this._isSection
  }

  get isSuperGroup() : boolean {
    return this._isSuperGroup
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

  get isTitle() : boolean {
    return this._isTitle
  }

  get isWide() : boolean {
    return this._isWide
  }

  get isNoKey() : boolean {
    return this._isNoKey
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
    this.isMatched = this.parent ? this.parent.isMatched : false
    this.matchedColumns.clear()
    let isExcluded = false
    filterGroups.forEach(filters => {
      this.cells.map(cell => cell.match(filters))
        .forEach(matchResult => {
          isExcluded = isExcluded || matchResult[0]
          !isExcluded && matchResult[1].forEach(filter => matchedFilters.add(filter))
        })
      const rowMatched = !isExcluded && matchedFilters.size === filters.length
      if(rowMatched) {
        this.appliedFilters = this.appliedFilters.concat(filters).filter(filter => filter.length > 0)
        if(!this.isSomeGroup) {
          this.cells.forEach((cell, index) => cell.isMatched && this.matchedColumns.add(index))
        } else {
          this.children.forEach(row => row.isMatched = true)
        }
        this.isMatched = true
      }
    })
    isExcluded && (this.isMatched = false)
    return this.isSomeGroup ? true : this.isMatched
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
      const newRow = new Row(this.index, this.content, this.groupIndex, this.subGroupIndex, 
                      this.sectionIndex, this.headersCount, this.healthColumnIndex,
                      this.isLog, formattedCellContent, this.appliedFilters)
      newRow._isNoKey = this._isNoKey
      newRow._isTitle = this._isTitle
      return [newRow, true]
    } else {
      return [this, false]
    }
  }
}

export default class OutputManager {
  static headers: any[] = []
  static rows: Row[] = []
  static filteredRows: Row[] = []
  static matchedColumns: Set<number> = new Set

  private static healthColumnIndex: number = -1
  private static appliedFilters: string[][] = []
  private static isLog: boolean = false
  private static groupCount: number = 0
  private static subGroupCount: number = 0
  private static sectionCount: number = 0

  private static lastGroupRow?: Row
  private static lastSubGroupRow?: Row
  private static lastSectionRow?: Row
  private static lastGroupVisibleCount: number = 0
  private static lastSubGroupVisibleCount: number = 0
  private static lastSectionVisibleCount: number = 0
  private static rowLimit: number = 0
  private static currentGroupings: any = {}

  static setOutput(output: ActionOutput, isLog: boolean, rowLimit: number = 0) {
    this.clearContent()
    this.rowLimit = rowLimit
    this.isLog = isLog || false
    this.headers = output && output.length > 0 ? output.slice(0, 1)[0] : []
    this.identifyHealthColumn()
    this.groupCount = 0
    this.subGroupCount = 0
    this.sectionCount = 0
    this.currentGroupings = {}
    this.rows = output && output.length > 0 ? 
        output.slice(1).map((content, rowIndex) => {
          const row = new Row(rowIndex, content, this.groupCount, this.subGroupCount, this.sectionCount, 
                                  this.headers.length, this.healthColumnIndex, this.isLog)
          this.updateRowMetaData(row)
          return row
        }) 
        : []
    this.filteredRows = this.rows.concat()
  }

  static appendRows(rows: ActionOutput) {
    let lastRowIndex = this.rows.length-1
    let appendedCount = 0
    this.rows.forEach(row => row.isFirstAppendedRow = false)
    let isFirstAppendedRow = false
    rows.forEach(rowContent => {
      lastRowIndex++
      appendedCount++
      const row = new Row(lastRowIndex, rowContent, this.groupCount, this.subGroupCount, this.sectionCount,
                                this.headers.length, this.healthColumnIndex, this.isLog)
      this.updateRowMetaData(row)
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
    if(this.rowLimit > 0) {
      this.filteredRows = this.filteredRows.slice(-this.rowLimit)
    }
    if(appendedCount > this.rowLimit) {
      this.filteredRows[0].isFirstAppendedRow = true
    }
  }

  static clearContent() {
    this.appliedFilters = []
    this.headers = []
    this.rows = []
    this.filteredRows = []
    this.healthColumnIndex = -1
    this.matchedColumns.clear()
    this.isLog = false
    this.groupCount = this.subGroupCount = this.sectionCount = 0
    this.lastGroupRow = this.lastSubGroupRow = this.lastSectionRow = undefined
    this.lastGroupVisibleCount = this.lastSubGroupVisibleCount = this.lastSectionVisibleCount = 0
    this.rowLimit = 0
  }

  private static updateRowMetaData(row: Row) {
    if(row.isSuperGroup) {
      this.currentGroupings.currentSuperGroup = row
    } else if(row.isGroup) {
      if(this.currentGroupings.currentSuperGroup) {
        row.parent = this.currentGroupings.currentSuperGroup
      }
      row.parent && row.parent.children.push(row)
      this.currentGroupings.currentGroup = row
      row.groupIndex = ++this.groupCount
      row.subGroupIndex = -1
      row.sectionIndex = -1
      ++this.subGroupCount
      ++this.sectionCount
    } else if(row.isSubGroup) {
      if(this.currentGroupings.currentSuperGroup) {
        row.parent = this.currentGroupings.currentSuperGroup
      }
      if(this.currentGroupings.currentGroup) {
        row.parent = this.currentGroupings.currentGroup
      }
      row.parent && row.parent.children.push(row)
      this.currentGroupings.currentSubGroup = row
      row.subGroupIndex = ++this.subGroupCount
      row.sectionIndex = -1
      ++this.sectionCount
    } else if(row.isSection) {
      if(this.currentGroupings.currentSuperGroup) {
        row.parent = this.currentGroupings.currentSuperGroup
      }
      if(this.currentGroupings.currentGroup) {
        row.parent = this.currentGroupings.currentGroup
      }
      if(this.currentGroupings.currentSubGroup) {
        row.parent = this.currentGroupings.currentSubGroup
      }
      row.parent && row.parent.children.push(row)
      this.currentGroupings.currentSection = row
      row.sectionIndex = ++this.sectionCount
    } else {
      if(this.currentGroupings.currentSuperGroup) {
        row.parent = this.currentGroupings.currentSuperGroup
      }
      if(this.currentGroupings.currentGroup) {
        row.parent = this.currentGroupings.currentGroup
      }
      if(this.currentGroupings.currentSubGroup) {
        row.parent = this.currentGroupings.currentSubGroup
      }
      if(this.currentGroupings.currentSection) {
        row.parent = this.currentGroupings.currentSection
      }
      row.parent && row.parent.children.push(row)
    }
  }

  private static identifyHealthColumn() {
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

  static clearFilter() {
    this.appliedFilters = []
    this.rows.forEach(row => row.clearFilter())
    this.filteredRows = this.rows.concat()
    this.matchedColumns.clear()
    this.groupCount = this.subGroupCount = this.sectionCount = 0
    this.lastGroupRow = this.lastSubGroupRow = this.lastSectionRow = undefined
    this.lastGroupVisibleCount = this.lastSubGroupVisibleCount = this.lastSectionVisibleCount = 0
  }

  static get hasContent() {
    return this.headers.length > 0 || this.rows.length > 0
  }

  static get hasFilteredContent() {
    return this.filteredRows && this.filteredRows.length > 0
  }

  static filter(inputText: string) {
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

  private static reprocessFilteredRow(row: Row) {
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

  private static showeHideParentRow(parentRow, visibleCount) {
    if(visibleCount > 0) {
      parentRow.isMatched = true
    } else if(parentRow.isMatched) {
      parentRow.children.forEach(c => {
        c.isMatched = true
        c.isHidden = true
      })
    }
  }

  private static highlightFilter() {
    this.filteredRows.forEach((row,i) => {
      const [highlightedRow, rowChanged] = row.highlightFilters()
      if(rowChanged) {
        this.filteredRows[i] = highlightedRow
      }
    })
  }

  static getRowsForGroup(groupIndex: number) {
    return this.rows.filter(row => row.groupIndex === groupIndex)
  }

  static getRowsForSubGroup(subGroupIndex: number) {
    return this.rows.filter(row => row.subGroupIndex === subGroupIndex)
  }

  private static showeHideRows(filterPredicate) {
    let anyHidden: boolean = false
    let anyVisible: boolean = false
    this.filteredRows.filter((row,index) => filterPredicate(row, index))
      .map(row => {
        anyHidden = anyHidden || row.isHidden
        anyVisible = anyVisible || !row.isHidden
        return row
      })
      .forEach(row => {
        row.isHidden = (anyVisible && anyHidden) ? false : !row.isHidden
      })
  }

  static showeHideAllGroups() {
    this.showeHideRows((row,index) => index > 0 && !row.isGroup && !row.isSubGroup && !row.isSection)
  }

  static showeHideGroup(groupIndex: number) {
    this.showeHideRows((row,index) => row.groupIndex === groupIndex
                        && index > 0 && !row.isGroup && !row.isSubGroup && !row.isSection)
  }

  static showeHideSubGroup(subGroupIndex: number) {
    this.showeHideRows((row,index) => row.subGroupIndex === subGroupIndex
                        && index > 0 && !row.isGroup && !row.isSubGroup && !row.isSection)
  }

  static showeHideSection(sectionIndex: number) {
    this.showeHideRows((row,index) => row.sectionIndex === sectionIndex 
                        && index > 0 && !row.isGroup && !row.isSubGroup && !row.isSection)
  }
}