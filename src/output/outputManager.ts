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
  "active", "healthy", "good", "green", "up", "run", "start", "success", 
  "complete", "created", "available", "ready", "normal"
]
const unhealthyKeywords : string[] = [
  "inactive", "unhealthy", "bad", "red", "down", "stop", "terminat", "wait", 
  "warning", "error", "fail", "not available", "unable"
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
  isArray: boolean
  isJSON: boolean
  isText: boolean
  isGroup = false
  isSubGroup = false  
  isHealthStatusField = false

  //isArrayOfJSON: boolean = false
  private content: CellContent
  private formattedContent: CellContent
  private stringContent: string = ''
  private isFiltered: boolean = false
  
  constructor(content: CellContent, index:number, formattedContent?: CellContent, 
              isFiltered?: boolean, isGroup?: boolean, isSubGroup?: boolean, isHealthStatusField?: boolean) {
    this.index = index
    this.isText = jsonUtil.isText(content)
    this.isArray = jsonUtil.isArray(content)
    this.isJSON = jsonUtil.isObject(content)
    if(this.isText && (this.isArray || this.isJSON)) {
      content = JSON.parse(content as string)
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

  render(renderer: ContentRenderer) : any {
    if(this.isArray) {
      return (this.content as any[]).map((item, i) => {
        const isJSON = jsonUtil.isObject(item) || jsonUtil.isArray(item)
        let formattedText = this.formattedContent[i]
        if(isJSON) {
          formattedText = "<pre>" + 
            (this.isFiltered ? formattedText : hljs.highlightAuto(formattedText).value)
            + "</pre>"
        }
        return renderer(formattedText, i)
      })
    } else {
      let formattedText = this.formattedContent as string
      if(this.isJSON) {
        formattedText = "<pre>" + 
        (this.isFiltered ? formattedText : hljs.highlightAuto(formattedText).value)
        + "</pre>"
      }
      return renderer(this.isGroup || this.isSubGroup? this.groupText : formattedText, 0)
    }
  }

  get groupText() {
    let groupTitle = this.isText && this.formattedContent !== "---" ? this.formattedContent as string : ""
    if(this.isSubGroup) {
      groupTitle = groupTitle.slice(1)
    }
    return groupTitle
  }

  matches(otherCell: Cell) {
    return this.stringContent.localeCompare(otherCell.stringContent) === 0
  }

  get isHealthy() {
    return healthyKeywords.filter(word => this.stringContent.includes(word)).length > 0
          && unhealthyKeywords.filter(word => this.stringContent.includes(word)).length == 0
  }

  get isUnhealthy() {
    return unhealthyKeywords.filter(word => this.stringContent.includes(word)).length > 0
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

  private content: CellContent[]
  private healthColumnIndex?: number
  private firstColumn?: Cell
  private lastColumn?: Cell
  private secondLastColumn?: Cell
  private appliedFilters: string[] = []
  private _isGroup: boolean = false
  private _isSubgroup: boolean = false

  constructor(index: number, content: CellContent[], healthColumnIndex?: number, formattedContent?: CellContent[],  
                appliedFilters?: string[]) {
    this.index = index
    this.content = content
    this.appliedFilters = appliedFilters || []
    this._isSubgroup = content.length > 0 && content[0].toString().startsWith(">")
    this._isGroup = !this._isSubgroup && content.includes("---") || false

    this.cells = content.map((cellContent, cellIndex) => 
        new Cell(cellContent, cellIndex,  
          formattedContent ? formattedContent[cellIndex] : undefined,
          this.appliedFilters.length > 0,
          this.isGroup, this.isSubGroup,
          healthColumnIndex ? healthColumnIndex === cellIndex : false
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
    if(this.isGroup) {
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
      return [new Row(this.index, this.content, this.healthColumnIndex, 
                        formattedCellContent, this.appliedFilters), true]
    } else {
      return [this, false]
    }
  }
}

export default class OutputManager {
  output: ActionOutput = []
  headers: any[] = []
  rows: Row[] = []
  filteredRows: Row[] = []
  healthColumnIndex: number = -1
  appliedFilters: string[][] = []

  setOutput(output: ActionOutput) {
    this.output = output
    this.headers = output && output.length > 0 ? output.slice(0, 1)[0] : []
    this.identifyHealthColumn()
    this.filteredRows = this.rows = 
      this.output && this.output.length > 0 ? 
        this.output.slice(1).map((content, rowIndex) => 
          new Row(rowIndex, content, this.healthColumnIndex)) : []
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
    this.filteredRows = this.rows
  }

  get hasContent() {
    return this.rows && this.rows.length > 0
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
}