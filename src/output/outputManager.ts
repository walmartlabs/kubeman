import { ActionOutput } from "../actions/actionSpec"
import _ from 'lodash'
import StringBuffer from '../util/stringbuffer'
import {appTheme} from '../theme/theme'

const healthyKeywords : string[] = [
  "active", "healthy", "good", "green", "up", "run", "start", "success", "complete", "created", "available",
  "no issue", "ready"
]
const unhealthyKeywords : string[] = [
  "inactive", "unhealthy", "bad", "red", "down", "stop", "terminat", "wait", "warning", "error", 
  "fail", "not available"
]


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
      let highlightedText = "<span style='background-color:" + highlightColor + "'>" 
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
    let highlightedText = "<span style='background-color:" + highlightColor + "'>" 
                          + text.slice(startPos, endPos+1) 
                          + "</span>"
    sb.append(highlightedText)
    cellChanged = true
  }
  sb.append(text.slice(endPos+1))
  return [sb.toString(), cellChanged]
}

export interface ContentRenderer {
  render(text: string)
}

export type CellContent = string|[]|Object

export class Cell {
  _content: CellContent
  _stringContent: string
  _isArray: boolean
  _isJSON: boolean
  _isText: boolean
  lowercaseContent: string
  
  constructor(content: CellContent) {
    this._isText = typeof content === 'string'
    this._isArray = content instanceof Array
    this._isJSON = typeof content === 'object' || 
          (typeof content === 'string' && content.startsWith("{") && content.endsWith("}"))
    if(this._isArray) {
      content = (content as any[]).map(item => 
        item ? typeof item === 'string' ? item : JSON.stringify(item, null, 2) : "")
    }
    this._content = content
    this._stringContent = content ?
        this._isText ? content as string :
        (this._isArray || this._isJSON) ? JSON.stringify(content, null, 2) 
        : content.toString()
        : ""
    this.lowercaseContent = this._stringContent.toLowerCase()
  }

  get isText() {
    return this._isText
  }

  get isArray() {
    return this._isArray
  }

  get isJSON() {
    return this._isJSON
  }

  get isSubGroup() {
    return this._isText && this._stringContent.startsWith(">")
  }

  get content() {
    return this._content
  }

  get text() {
    return this._stringContent
  }

  get groupText() {
    let groupTitle = this._isText && this._stringContent !== "---" ? this._stringContent : ""
    if(this.isSubGroup) {
      groupTitle = groupTitle.slice(1)
    }
    return groupTitle
  }

  map(mapper: (formattedText: string, text: string, index: number) => any) : any[] {
    if(this._isArray) {
      return (this._content as any[]).map((item, i) => {
        const isJSON = item.startsWith("{") && item.endsWith("}")
        let formattedText = isJSON ? "<pre>" + item + "</pre>" : item
        return mapper(formattedText, item, i)
      })
    }
    return []
  }

  match(filters: string[]) : string[] {
    const matchingFilters : string[] = []
    filters.map(filter => {
      if(this.lowercaseContent.includes(filter)) {
        matchingFilters.push(filter)
      }
    })
    return matchingFilters
  }

  highlight(filters: string[]) : [CellContent, boolean] {
    if(this._isText) {
      return applyHighlight(this._content as string, filters)
    } else if(this._isArray) {
      const changedCellData : Array<[string, boolean]> = []
      let cellChanged = false
      const arrayContent = this._content as []
      arrayContent.forEach((text,i) => {
        changedCellData[i] = applyHighlight(text, filters)
        cellChanged = cellChanged || changedCellData[i][1]
      })
      if(cellChanged) {
        let newCellContent : string[] = []
        changedCellData.forEach((data, i) => newCellContent.push(data[0]))
        return [newCellContent, true]
      }
    } else if(this._isJSON) {
      const changedCellData = {}
      let cellChanged = false
      Object.keys(this._content)
      .forEach(key => {
        const value = this._content[key]
        const highlightedKey = applyHighlight(key, filters)
        const highlightedValue = applyHighlight(value, filters)
        changedCellData[highlightedKey[0]] = highlightedValue[0]
        cellChanged = cellChanged || highlightedKey[1] || highlightedValue[1]
      })
      if(cellChanged) {
        return [changedCellData, true]
      }
    }
    return [this._content, false]
  }

  compareWith(otherCell: Cell) {
    return this._stringContent.localeCompare(otherCell._stringContent)
  }

  matches(otherCell: Cell) {
    return this._stringContent.localeCompare(otherCell._stringContent) === 0
  }

  render(renderer: ContentRenderer) {
    if(this._isArray) {
      (this._content as []).map(renderer.render)
    } else if(this._isJSON) {
      renderer.render("<pre>" + JSON.stringify(this._content, null, 2) + "</pre>")
    } else {
      renderer.render(this._stringContent)
    }
  }
}

export class Row {
  _index: number
  _cells: Cell[]
  _firstColumn?: Cell
  _lastColumn?: Cell
  _secondLastColumn?: Cell
  _isGroup: boolean = false
  _isSubgroup: boolean = false
  appliedFilters: string[] = []

  constructor(index: number, content: any[]) {
    this._index = index
    this._cells = content.map(item => new Cell(item))
    this._firstColumn = this._cells.length > 0 ? this._cells[0] : undefined
    this._lastColumn = this._cells.length > 0 ? this._cells[this._cells.length-1] : undefined
    this._secondLastColumn = this._cells.length > 1 ? this._cells[this._cells.length-2] : undefined
    this._isSubgroup = this._firstColumn ? this._firstColumn.isSubGroup : false
    this._isGroup = !this._isSubgroup && content.includes("---") || false
    //this.subgroup && (this.content[0] = this.content[0].substring(1))
  }

  get lastTwoColumnsDiffer() : boolean {
    if(this._secondLastColumn && this._lastColumn) {
      return !this._secondLastColumn.matches(this._lastColumn)
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
    return this._firstColumn ? this._firstColumn.groupText : ""
  }

  get cells() {
    return this._cells
  }

  get columnCount() {
    return this._cells.length
  }

  filter(filterGroups: string[][]) : boolean {
    if(this.isGroup) {
      return true
    } else {
      this.appliedFilters = []
      let anyMatched = false, allMatched = false
      filterGroups.forEach(filters => {
        const matchedFilters : Set<String> = new Set
        this._cells.map(cell => cell.match(filters)).forEach(matchingFilters => 
                        matchingFilters.forEach(filter => matchedFilters.add(filter)))
        const rowMatched = matchedFilters.size === filters.length
        if(rowMatched) {
          this.appliedFilters = this.appliedFilters.concat(filters)
        }
        anyMatched = anyMatched || rowMatched
      })
      return anyMatched
    }
  }

  highlightFilters() : [Row, boolean] {
    const newCellContent : CellContent[] = []
    let rowChanged = false
    const filters = this.appliedFilters.filter(filter => filter.length > 0)
    this._cells.forEach((cell, i) => {
      const newCellData = cell.highlight(filters)
      newCellContent.push(newCellData[0])
      rowChanged = rowChanged || newCellData[1]
    })
    if(rowChanged) {
      return [new Row(this._index, newCellContent), true]
    } else {
      return [this, false]
    }
  }
}

export default class OutputManager {
  output: ActionOutput = []
  _headers: any[] = []
  _rows: Row[] = []
  _filteredRows: Row[] = []
  _healthColumnIndex: number = -1
  appliedFilters: string[][] = []

  setOutput(output: ActionOutput) {
    this.output = output
    this._headers = output && output.length > 0 ? output.slice(0, 1)[0] : []
    this._filteredRows = this._rows = this.output && this.output.length > 0 ? 
                this.output.slice(1).map((row, index) => new Row(index, row)) : []
    
    this._healthColumnIndex = this._headers.length > 0 ? this._headers.map(header => 
            header instanceof Array ? header.map(item => item.toLowerCase()) :
            typeof header === 'string' ? header.toLowerCase() : header)
      .map((header,index) => (header.includes("status") || header.includes("health") 
            || header.includes("condition") ? index : -1))
      .reduce((prev, curr) => prev >= 0 ? prev : curr >= 0 ? curr : -1) : -1
    this._healthColumnIndex = this._healthColumnIndex >= 0 ? this._healthColumnIndex : this._headers.length-1
  }

  clearFilter() {
    this.appliedFilters = []
    this._filteredRows = this._rows
  }

  get hasContent() {
    return this._rows && this._rows.length > 0
  }

  get hasFilteredContent() {
    return this._filteredRows && this._filteredRows.length > 0
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
      this._filteredRows = this._rows.filter((row,i) => row.filter(filters))
      this.highlightFilter()
    }
  }

  private highlightFilter() {
    this._filteredRows.forEach((row,i) => {
      const [highlightedRow, rowChanged] = row.highlightFilters()
      if(rowChanged) {
        this._filteredRows[i] = highlightedRow
      }
    })
  }

  isHealthy(text: string) {
    return healthyKeywords.filter(word => text.includes(word)).length > 0
          && unhealthyKeywords.filter(word => text.includes(word)).length == 0
  }

  isUnhealthy(text: string) {
    return unhealthyKeywords.filter(word => text.includes(word)).length > 0
  }

  get headers() {
    return this._headers
  }

  get filteredRows() {
    return this._filteredRows
  }

  get healthColumnIndex() {
    return this._healthColumnIndex
  }

}