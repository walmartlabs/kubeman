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
  "complete", "created", "available", "ready", "normal", "reachable"
]
const unhealthyKeywords : string[] = [
  "inactive", "unhealthy", "bad", "stop", "terminated", "terminating", "wait", 
  "warning", "error", "fail", "not available", "unavailable", "unable", "unreachable"
]

const ignoreKeywords: string[] = [
  "maxunavailable"
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
  isGroup = false
  isSubGroup = false  
  isHealthStatusField = false

  //isArrayOfJSON: boolean = false
  private content: CellContent
  private formattedContent: CellContent
  private stringContent: string = ''
  private isFiltered: boolean = false
  
  constructor(content: CellContent, index:number, formattedContent?: CellContent, 
              isFiltered?: boolean, isGroup?: boolean, isSubGroup?: boolean, 
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

    this.isFiltered = isFiltered || false
    this.isGroup = isGroup || false
    this.isSubGroup = isSubGroup || false
    this.isHealthStatusField = isHealthStatusField || false
  }

  match(filters: string[]) : string[] {
    const appliedFilters : string[] = []
    filters.map(filter => {
      if(this.stringContent.includes(filter)) {
        appliedFilters.push(filter)
      }
    })
    return appliedFilters
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
      return (this.content as any[]).map((item, i) => {
        return renderer(this.formatText(this.formattedContent[i], 
                        jsonUtil.isObject(item) || jsonUtil.isArray(item)), i)
      })
    } else {
      return renderer(this.isGroup || this.isSubGroup ? this.groupText 
            : this.formatText(this.formattedContent, this.isJSON), 0)
    }
  }

  get groupText() {
    let groupTitle = this.isText ? this.formattedContent as string : ""
    if(this.isGroup) {
      groupTitle = groupTitle.slice(1)
    } else if(this.isSubGroup) {
      groupTitle = groupTitle.slice(2)
    }
    return groupTitle
  }

  matches(otherCell: Cell) {
    return this.stringContent.localeCompare(otherCell.stringContent) === 0
  }

  get isHealthy() {
    return healthyKeywords.filter(word => this.stringContent.includes(word)).length > 0
          && unhealthyKeywords.filter(word => this.stringContent.includes(word)).length == 0
          && ignoreKeywords.filter(word => this.stringContent.includes(word)).length == 0
  }

  get isUnhealthy() {
    return unhealthyKeywords.filter(word => this.stringContent.includes(word)).length > 0
            && ignoreKeywords.filter(word => this.stringContent.includes(word)).length == 0
  }

  get isFirstColumn() {
    return this.index === 0 && !this.isGroup
  }

  toString() {
    return this.formattedContent.toString()
  }
}

export class Row {
  index: number
  cells: Cell[]
  isLog: boolean = false
  isFirstAppendedRow: boolean = false
  groupIndex: number = 0
  isHidden: boolean = false

  private content: CellContent[]
  private healthColumnIndex?: number
  private firstColumn?: Cell
  private lastColumn?: Cell
  private secondLastColumn?: Cell
  private appliedFilters: string[] = []
  private _isGroup: boolean = false
  private _isSubgroup: boolean = false

  constructor(index: number, content: CellContent[], groupIndex: number, 
              healthColumnIndex?: number, isLog?: boolean, 
              formattedContent?: CellContent[], appliedFilters?: string[]) {
    this.index = index
    this.content = content
    this.groupIndex = groupIndex
    this.isLog = isLog || false 
    this.appliedFilters = appliedFilters || []
    this._isSubgroup = content.length > 0 && content[0].toString().startsWith(">>") || false
    this._isGroup = !this._isSubgroup && content[0].toString().startsWith(">") || false

    this.cells = content.map((cellContent, cellIndex) => 
        new Cell(cellContent, cellIndex,  
          formattedContent ? formattedContent[cellIndex] : undefined,
          this.appliedFilters.length > 0,
          this.isGroup, this.isSubGroup,
          healthColumnIndex ? healthColumnIndex === cellIndex : false,
          isLog || false
          ))
    this.healthColumnIndex = healthColumnIndex
    this.firstColumn = this.cells.length > 0 ? this.cells[0] : undefined
    this.lastColumn = this.cells.length > 0 ? this.cells[this.cells.length-1] : undefined
    this.secondLastColumn = this.cells.length > 1 ? this.cells[this.cells.length-2] : undefined
  }

  get lastTwoColumnsDiffer() : boolean {
    if(this.secondLastColumn && this.lastColumn) {
      return !this.secondLastColumn.matches(this.lastColumn)
    } else {
      return false
    }
  }

  get isGroupOrSubgroup() : boolean {
    return this._isGroup || this._isSubgroup
  }

  get isGroup() : boolean {
    return this._isGroup && !this._isSubgroup
  }

  get isSubGroup() : boolean {
    return this._isSubgroup && !this._isGroup
  }

  get groupText() : string {
    return this.firstColumn ? this.firstColumn.groupText : ""
  }

  get columnCount() {
    return this.cells.length
  }

  filter(filterGroups: string[][]) : boolean {
    if(this.isGroup || this.isSubGroup) {
      return true
    } else {
      this.appliedFilters = []
      let anyMatched = false, allMatched = false
      filterGroups.forEach(filters => {
        const matchedFilters : Set<String> = new Set
        this.cells.map(cell => cell.match(filters)).forEach(matchingFilters => 
                        matchingFilters.forEach(filter => matchedFilters.add(filter)))
        const rowMatched = matchedFilters.size === filters.length
        if(rowMatched) {
          this.appliedFilters = this.appliedFilters.concat(filters).filter(filter => filter.length > 0)
        }
        anyMatched = anyMatched || rowMatched
      })
      return anyMatched
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
      return [new Row(this.index, this.content, this.groupIndex, this.healthColumnIndex, 
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
  healthColumnIndex: number = -1
  appliedFilters: string[][] = []
  isLog: boolean = false
  groupCount: number = 0

  setOutput(output: ActionOutput, isLog: boolean) {
    this.isLog = isLog || false
    this.headers = output && output.length > 0 ? output.slice(0, 1)[0] : []
    this.identifyHealthColumn()
    this.groupCount = 0
    this.rows = 
      output && output.length > 0 ? 
        output.slice(1).map((content, rowIndex) => {
          const row = new Row(rowIndex, content, this.groupCount, this.healthColumnIndex, this.isLog)
          if(row.isGroup) {
            row.groupIndex = ++this.groupCount
          }
          return row
        }) : []
    this.filteredRows = this.rows.concat()
  }

  appendRows(rows: ActionOutput) {
    let lastRowIndex = this.rows.length-1
    this.rows.forEach(row => row.isFirstAppendedRow = false)
    let isFirstAppendedRow = false
    rows.forEach(rowContent => {
      lastRowIndex++
      const row = new Row(lastRowIndex, rowContent, this.groupCount, this.healthColumnIndex, this.isLog)
      if(row.isGroup) {
        row.groupIndex = ++this.groupCount
      }
      this.rows.push(row)
      if(!isFirstAppendedRow) {
        row.isFirstAppendedRow = isFirstAppendedRow = true
      }
      if(this.appliedFilters.length === 0) {
        this.filteredRows.push(row)
      } else if(row.filter(this.appliedFilters)) {
        const [highlightedRow, rowChanged] = row.highlightFilters()
        this.filteredRows.push(highlightedRow)
      }
    })
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
    this.filteredRows = this.rows.concat()
  }

  get hasContent() {
    return this.headers.length > 0 || this.rows.length > 0
  }

  get hasFilteredContent() {
    return this.filteredRows && this.filteredRows.length > 0
  }

  filter = (inputText: string) => {
    inputText = inputText.toLowerCase()
    const matchAny = inputText.includes(" or ")
    const filters : string[][] = 
                  inputText.toLowerCase().split(" or ")
                  .filter(group => group.length > 0)
                  .map(group => group.split(" "))
                  .filter(word => word.length > 0)

    if(filters.length === 0) {
      this.clearFilter()
    } else {
      this.appliedFilters = filters
      this.filteredRows = this.rows.filter((row,i) => row.filter(filters))
      this.highlightFilter()
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

  showeHideGroup(groupIndex: number) {
    this.rows.filter(row => row.groupIndex === groupIndex)
      .filter((row,index) => index > 0)
      .forEach(row => row.isHidden = !row.isHidden)
  }
}