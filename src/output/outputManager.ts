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

function applyHighlight(text: string, filters: string[]) {
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
  return {content: sb.toString(), changed: cellChanged}
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
  content: CellContent = ''
  formattedContent: CellContent = ''
  filteredIndexes: number[] = []
  stringContent: string = ''
  
  constructor(content: CellContent, index:number, appliedFilters?: string[],
              isSuperGroup?: boolean, isGroup?: boolean, isSubGroup?: boolean, isSection?: boolean,
              isHealthStatusField?: boolean, isLog?: boolean) {
    this.index = index
    this.isLog = isLog || false
    if(content) {
      this.isText = jsonUtil.isText(content)
      this.isArray = jsonUtil.isArray(content)
      this.isJSON = jsonUtil.isObject(content)
      if(this.isText && (this.isArray || this.isJSON)) {
        try {
          content = JSON.parse(content as string)
          this.isText = false
        } catch(error) {
          this.isArray = this.isJSON = false
        }
      }
      this.content = content
      this.formattedContent = content
      if(this.isJSON) {
        this.stringContent = yaml.stringify(this.content).toLowerCase()
      } else if(this.isArray) {
        this.stringContent = (this.content as any[])
            .map(item => yaml.stringify(item)).join(" ").toLowerCase()
      } else {
        this.stringContent = this.content.toString().toLowerCase()
      }
      this.formatContent()
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

  formatContent() {
    if(this.isJSON) {
      this.formattedContent = jsonUtil.isObject(this.formattedContent) ? 
                              yaml.stringify(this.formattedContent) : this.formattedContent.toString()
    } else if(this.isArray) {
      this.formattedContent = (this.formattedContent as any[]).map(item =>
         (jsonUtil.isObject(item) || jsonUtil.isArray(item)) ? yaml.stringify(item) : item.toString())
    } else {
      this.formattedContent = this.formattedContent ? this.formattedContent.toString() : ""
    }
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
    this.isFiltered = false
    this.filteredIndexes = []
    this.isMatched = false
    this.formattedContent = this.content
    this.formatContent()
  }

  highlight(filters: string[]) : boolean {
    let cellChanged = false
    let newContent
    if(this.isArray) {
      newContent = []
      const arrayContent = this.content as []
      arrayContent.forEach((item,i) => {
        const isJSON = jsonUtil.isObject(item) || jsonUtil.isArray(item)
        const {content, changed} = applyHighlight(isJSON ? yaml.stringify(item) : item, filters)
        cellChanged = cellChanged || changed
        newContent.push(content)
      })
    } else {
      const {content, changed} = applyHighlight(
        this.isJSON ? yaml.stringify(this.content) : this.content as string, filters)
      changed && (newContent = content)
      cellChanged = changed
    }
    if(cellChanged) {
      this.isFiltered = true
      this.formattedContent = newContent
      this.formatContent()
    }
    return cellChanged
  }

  formatText(text: any, isJSON: boolean) {
    if(text) {
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
    return ''
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
  superGroupIndex: number = 0
  groupIndex: number = 0
  subGroupIndex: number = 0
  sectionIndex: number = 0
  parent?: Row = undefined
  children: Row[] = []
  filteredChildren: Row[] = []
  isEmpty: boolean = false
  isVisible: boolean = true
  isMatched: boolean = false
  hiddenChildCount: number = 0
  visibleChildCount: number = 0

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

  constructor(index: number, content: CellContent[], headersCount: number, 
              healthColumnIndex?: number, isLog?: boolean, appliedFilters?: string[]) {
    this.index = index
    this.content = content
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
          new Cell(cellContent, subRowIndex+cellIndex, this.appliedFilters, false, false, false, false, false, isLog || false))
        )
        //this.cells = _.flatten(this.subTable)
      } else {
        this.cells = content.map((cellContent, cellIndex) => 
          new Cell(cellContent, cellIndex,
            this.appliedFilters, this.isSuperGroup,
            this.isGroup, this.isSubGroup, this._isSection,
            healthColumnIndex ? healthColumnIndex === (cellIndex) : false,
            isLog || false
            ))
      }
      const prefixedRow = this._isSuperGroup || this._isTitle || this._isNoKey
      if(prefixedRow) {
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

  hideRow() {
    if(this.isVisible) {
      this.isVisible = false
      this.parent && this.parent.hiddenChildCount++
      this.parent && this.parent.visibleChildCount--
    }
  }

  showRow() {
    if(!this.isVisible) {
      this.isVisible = true
      this.parent && this.parent.hiddenChildCount--
      this.parent && this.parent.visibleChildCount++
    }
  }

  get isSomeGroup() : boolean {
    return this._isSuperGroup || this._isGroup || this._isSubgroup || this._isSection
  }

  get isAlwaysVisibleGroup() : boolean {
    return this._isSuperGroup || this._isGroup || this._isSubgroup
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
    this.isVisible = true
    this.hiddenChildCount = 0
    this.visibleChildCount = this.children.length
    this.isMatched = false
    this.appliedFilters = []
    this.matchedColumns.clear()
    this.filteredChildren = this.children.concat()
    this.cells.forEach(cell => cell.clearFilter())
  }

  filter(filterGroups: string[][]) : boolean {
    this.appliedFilters = []
    this.isMatched = false
    this.matchedColumns.clear()
    let isExcluded = false
    filterGroups.forEach(filters => {
      const matchedFilters : Set<String> = new Set
      this.cells.map(cell => cell.match(filters))
      .forEach(matchResult => {
          isExcluded = isExcluded || matchResult[0]
          !isExcluded && matchResult[1].forEach(filter => matchedFilters.add(filter))
      })
      if(isExcluded) {
        this.isMatched = false
      } else {
        const isMatched =  matchedFilters.size === filters.length
        if(isMatched) {
          this.appliedFilters = this.appliedFilters.concat(filters).filter(filter => filter.length > 0)
          if(!this.isSomeGroup) {
            this.cells.forEach((cell, index) => cell.isMatched && this.matchedColumns.add(index))
          }
          this.isMatched = true
        }
      }
    })
    this.isMatched ? this.showRow() : this.hideRow()
    return this.isMatched
  }

  highlightFilters() {
    this.cells.forEach((cell, i) => cell.highlight(this.appliedFilters))
  }

  updateFilteredChild(childRow: Row) {
    this.filteredChildren.forEach((row,i) => row.index === childRow.index 
      && (this.filteredChildren[i]= childRow))
  }

  getNextSibling() {
    if(this.parent) {
      const siblings = this.parent.children
      for(let i = 0; i < siblings.length; i++) {
        if(siblings[i].index === this.index) {
          return siblings[i+1]
        }
      }
    }
    return undefined
  }

  getRowsForTitle() {
    if(this.parent) {
      let siblings = this.parent.children
      siblings = siblings.filter(row => row.index > this.index)
      const titleRows: Row[] = []
      for(const row of siblings) {
        if(row.isTitle || row.isSomeGroup) {
          break
        }
        titleRows.push(row)
      }
      return titleRows
    }
    return undefined
  }

  getTitleForRow() {
    if(this.parent) {
      let siblings = this.parent.children
      siblings = siblings.filter(row => row.index < this.index)
      let titleRow
      let hasMoreSiblings = false
      for(const row of siblings) {
        if(row.isTitle) {
          titleRow = row
          hasMoreSiblings = false
        } else if(row.isSomeGroup) {
          titleRow = undefined
          hasMoreSiblings = false
        } else if(titleRow) {
          hasMoreSiblings = true
        }
      }
      return {titleRow, hasMoreSiblings}
    }
    return {}
  }
}

export default class OutputManager {
  static headers: any[] = []
  static rows: Row[] = []
  static filteredRows: Row[] = []
  static topRows: Row[] = []
  static matchedColumns: Set<number> = new Set

  private static healthColumnIndex: number = -1
  private static appliedFilters: string[][] = []
  private static isLog: boolean = false
  private static superGroupCount: number = 0
  private static groupCount: number = 0
  private static subGroupCount: number = 0
  private static sectionCount: number = 0

  private static rowLimit: number = 0
  private static currentGroupings: any = {}

  static setOutput(output: ActionOutput, isLog: boolean, rowLimit: number = 0) {
    this.clearContent()
    this.rowLimit = rowLimit
    this.isLog = isLog || false
    this.headers = output && output.length > 0 ? output.slice(0, 1)[0] : []
    this.identifyHealthColumn()
    this.superGroupCount = 0
    this.groupCount = 0
    this.subGroupCount = 0
    this.sectionCount = 0
    this.currentGroupings = {}
    this.rows = output && output.length > 0 ? 
        output.slice(1).map((content, rowIndex) => {
          const row = new Row(rowIndex, content, this.headers.length, this.healthColumnIndex, this.isLog)
          this.updateRowMetaData(row)
          return row
        }) 
        : []
    this.filteredRows = this.rows.concat()
    this.identifyTopRows()
    this.filteredRows.forEach(row => row.filteredChildren = row.children.concat())
  }

  static appendRows(rows: ActionOutput) {
    let lastRowIndex = this.rows.length-1
    let appendedCount = 0
    this.rows.forEach(row => row.isFirstAppendedRow = false)
    let isFirstAppendedRow = false
    rows.forEach(rowContent => {
      lastRowIndex++
      appendedCount++
      const row = new Row(lastRowIndex, rowContent, this.headers.length, this.healthColumnIndex, this.isLog)
      this.updateRowMetaData(row)
      this.rows.push(row)
      if(!isFirstAppendedRow) {
        row.isFirstAppendedRow = isFirstAppendedRow = true
      }
      if(this.appliedFilters.length === 0) {
        this.filteredRows.push(row)
      } else if(row.filter(this.appliedFilters)) {
        this.updateRowVisibility(row)
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
    this.identifyTopRows()
    if(this.appliedFilters.length === 0) {
      this.filteredRows.forEach(row => row.filteredChildren = row.children.concat())
    }
  }

  static clearContent() {
    this.headers = []
    this.rows = []
    this.topRows = []
    this.filteredRows = []
    this.healthColumnIndex = -1
    this.matchedColumns.clear()
    this.isLog = false
    this.rowLimit = 0
    this.groupCount = this.subGroupCount = this.sectionCount = 0
    this.currentGroupings = {}
    this.appliedFilters = []
  }

  private static updateRowMetaData(row: Row) {
    row.superGroupIndex = -1
    row.groupIndex = -1
    row.subGroupIndex = -1
    row.sectionIndex = -1

    if(row.isSuperGroup) {
      this.currentGroupings.currentSuperGroup = row
      row.superGroupIndex = ++this.superGroupCount
      ++this.groupCount
      ++this.subGroupCount
      ++this.sectionCount
      this.currentGroupings.currentGroup = undefined
      this.currentGroupings.currentSubGroup = undefined
      this.currentGroupings.currentSection = undefined
    } else if(row.isGroup) {
      if(this.currentGroupings.currentSuperGroup) {
        row.parent = this.currentGroupings.currentSuperGroup
      }
      row.parent && row.parent.children.push(row)
      this.currentGroupings.currentGroup = row
      row.superGroupIndex = this.superGroupCount
      row.groupIndex = ++this.groupCount
      ++this.subGroupCount
      ++this.sectionCount
      this.currentGroupings.currentSubGroup = undefined
      this.currentGroupings.currentSection = undefined
    } else if(row.isSubGroup) {
      if(this.currentGroupings.currentSuperGroup) {
        row.parent = this.currentGroupings.currentSuperGroup
      }
      if(this.currentGroupings.currentGroup) {
        row.parent = this.currentGroupings.currentGroup
      }
      row.parent && row.parent.children.push(row)
      this.currentGroupings.currentSubGroup = row
      row.superGroupIndex = this.superGroupCount
      row.groupIndex = this.groupCount
      row.subGroupIndex = ++this.subGroupCount
      ++this.sectionCount
      this.currentGroupings.currentSection = undefined
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
      row.superGroupIndex = this.superGroupCount
      row.groupIndex = this.groupCount
      row.subGroupIndex = this.subGroupCount
      row.sectionIndex = ++this.sectionCount
    } else {
      if(this.currentGroupings.currentSuperGroup) {
        row.parent = this.currentGroupings.currentSuperGroup
      }
      if(this.currentGroupings.currentGroup) {
        row.parent = this.currentGroupings.currentGroup
        //this.currentGroupings.currentGroup && this.currentGroupings.currentGroup.children.push(row)
      }
      if(this.currentGroupings.currentSubGroup) {
        row.parent = this.currentGroupings.currentSubGroup
        //this.currentGroupings.currentSubGroup && this.currentGroupings.currentSubGroup.children.push(row)
      }
      if(this.currentGroupings.currentSection) {
        row.parent = this.currentGroupings.currentSection
        //this.currentGroupings.currentSection && this.currentGroupings.currentSection.children.push(row)
      }
      row.parent && row.parent.children.push(row)
      row.superGroupIndex = this.superGroupCount
      row.groupIndex = this.groupCount
      row.subGroupIndex = this.subGroupCount
      row.sectionIndex = this.sectionCount
    }
  }

  private static identifyTopRows() {
    this.topRows = this.filteredRows.filter(row => !row.parent)
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
    this.rows.forEach(row => row.clearFilter())
    this.filteredRows = this.rows.concat()
    this.matchedColumns.clear()
    this.appliedFilters = []
    this.identifyTopRows()
  }

  static get columnCount() {
    return this.headers.length
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
      filteredRows.forEach(row => this.updateRowVisibility(row))
      this.filteredRows = this.rows.filter(row => row.isVisible)
      this.highlightFilter()
      this.identifyTopRows()
    }
  }

  private static updateRowVisibility(row: Row) {
    if(row.isMatched) {
      row.showRow()
    }
    if(row.isVisible) {
      if(row.parent && !row.parent.isVisible) {
        row.parent.showRow()
        this.updateRowVisibility(row.parent)
      }
      row.children.forEach(childRow => {
        if(row.isMatched && !childRow.isVisible) {
          childRow.isSomeGroup || childRow.isMatched ? childRow.showRow() : childRow.hideRow()
          childRow.isVisible && this.updateRowVisibility(childRow)
        }
      })
      if(row.isTitle) {
        const titleRows = row.getRowsForTitle()
        titleRows && titleRows.forEach(tr => tr.showRow())
      } else if(!row.isSomeGroup) {
        const {titleRow, hasMoreSiblings} = row.getTitleForRow()
        titleRow && (titleRow.showRow())
        hasMoreSiblings && titleRow.cells.forEach(cell => cell.isMatched = true)
      }
    }
  }

  private static highlightFilter() {
    this.filteredRows.forEach((row,i) => row.highlightFilters())
  }
  private static showeHideRows(filterPredicate, showAllGroups: boolean = true) {
    const applicableRows = this.rows.filter((row,i) => i > 0 && filterPredicate(row))
    const applicableGroupRows = applicableRows.filter(row => row.isSomeGroup)
    const applicableDataRows = applicableRows.filter(row => !row.isSomeGroup)
    showAllGroups && applicableGroupRows.forEach(row => row.showRow())

    let anyHidden: boolean = false
    let anyVisible: boolean = false
    applicableDataRows.map((row, i) => {
      anyHidden = anyHidden || !row.isVisible
      anyVisible = anyVisible || row.isVisible
      return row
    })
    .forEach(row => {
      if(anyVisible && anyHidden) {
        row.showRow()
      } else {
        row.isVisible ? row.hideRow() : row.showRow()
      } 
    })
  }

  static showeHideChildren(parentRow: Row) {
    this.showeHideRows(row =>
      parentRow.isSuperGroup && row.superGroupIndex === parentRow.superGroupIndex ||
      parentRow.isGroup && row.groupIndex === parentRow.groupIndex ||
      parentRow.isSubGroup && row.subGroupIndex === parentRow.subGroupIndex ||
      parentRow.isSection && row.sectionIndex === parentRow.sectionIndex
    )
  }

  static showeHideAllRows() {
    this.showeHideRows(row => !row.isSomeGroup, false)
  }
}