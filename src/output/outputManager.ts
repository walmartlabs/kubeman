import { ActionOutput } from "../actions/actionSpec"
import _ from 'lodash'
import StringBuffer from '../util/stringbuffer'
import {appTheme} from '../theme/theme'

const healthyKeywords : string[] = [
  "active", "healthy", "good", "green", "up", "run", "start"
]
const unhealthyKeywords : string[] = [
  "inactive", "unhealthy", "bad", "red", "down", "stop", "terminat", "wait"
]


function applyHighlight(text: string, filters: string[]) : [string, boolean] {
  const highlightColor = appTheme.activeTheme.palette && 
          appTheme.activeTheme.palette.type === 'dark' ? '#804d00' : '#FFCC80'

  const lowerText = text.toLowerCase()
  const matchPositions : Set<number> = new Set
  let cellChanged = false
  filters.forEach(filter => {
    let index = 0
    while((index = lowerText.indexOf(filter, index)) >= 0) {
      for(let i = index; i < index + filter.length; i++ ) {
        matchPositions.add(i)
      }
      index += filter.length
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
      
      let highlightedText = "<span className='background-color:" + highlightColor + "'>" 
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

export class Row {
  _content: any[] = []
  firstField: any
  lastField: any
  secondLastField: any
  group: boolean = false
  subgroup: boolean = false

  constructor(content: any[]) {
    this._content = content
    this.firstField = content.length > 0 ? content[0] : undefined
    this.lastField = content.length > 0 ? content[content.length-1] : undefined
    this.secondLastField = content.length > 1 ? content[content.length-2] : undefined
    this.subgroup = this.firstField && this.firstField.startsWith(">")
    this.group = !this.subgroup && this.content.includes("---") || false
    //this.subgroup && (this.content[0] = this.content[0].substring(1))
  }

  diffLastTwoFields() {
    if(this.secondLastField) {
      return this.secondLastField.localeCompare(this.lastField) !== 0
    } else {
      return false
    }
  }

  get isGroupOrSubgroup() {
    return this.group || this.subgroup
  }

  get isGroup() {
    return this.group && !this.subgroup
  }

  get isSubGroup() {
    return this.subgroup && !this.group
  }

  get content() {
    return this._content
  }

  filter(filters: string[]) : boolean {
    if(this.isGroup) {
      return true
    } else {
      return filters.map(filter =>
        this._content.map(item => 
          typeof item === 'string' ? item.toLowerCase().includes(filter)
          : item instanceof Array ? item.filter(text => text.toLowerCase().includes(filter)).length > 0
          : false
        ).reduce((r1,r2) => r1 || r2, false)
      ).reduce((r1,r2) => r1 && r2, true)
    }
  }

  highlight(filters: string[]) : [Row, boolean] {
    const newRowData : Array<[any, boolean]> = []
    let rowChanged = false
    this._content.forEach((cell, i) => {
      let cellChanged = false
      if(typeof cell === 'string') {
        newRowData[i] = applyHighlight(cell, filters)
        rowChanged = rowChanged || newRowData[i][1]
      } else if(cell instanceof Array) {
        const newCellData : Array<[string, boolean]> = []
        let cellChanged = false
        cell.forEach((text,j) => {
          newCellData[j] = applyHighlight(text, filters)
          cellChanged = cellChanged || newCellData[j][1]
        })
        if(cellChanged) {
          cell = _.cloneDeep(cell)
          newCellData.forEach((data, j) => cell[j] = data[0])
          rowChanged = true
        }
        newRowData[i] = [cell, cellChanged]
      }
    })
    if(rowChanged) {
      const newContent = _.cloneDeep(this._content)
      newRowData.forEach((data, i) => {
        if(data[1]) {
          newContent[i] = data[0]
        }
      })
      return [new Row(newContent), true]
    } else {
      return [this, false]
    }
  }
}

export default class OutputManager {
  output: ActionOutput = []
  headers: string[] = []
  _rows: Row[] = []
  filteredRows: Row[] = []
  appliedFilters: string[] = []
  healthColumnIndex: number = -1

  setOutput(output: ActionOutput) {
    this.output = output
    this.headers = output && output.length > 0 ? output.slice(0, 1)[0] : []
    this.filteredRows = this._rows = this.output && this.output.length > 0 ? 
                this.output.slice(1).map(row => new Row(row)) : []
    this.healthColumnIndex = this.headers.length > 0 ? this.headers.map(header => header.toLowerCase())
        .map((header,index) => (header.includes("status") || header.includes("health")?index:-1))
        .reduce((prev, curr) => prev >= 0 ? prev : curr >= 0 ? curr : -1) : -1
    this.healthColumnIndex = this.healthColumnIndex >= 0 ? this.healthColumnIndex : this.headers.length-1
  }

  clearFilter() {
    this.appliedFilters = []
    this.filteredRows = this._rows
  }

  get hasFilteredContent() {
    return this.filteredRows && this.filteredRows.length > 0
  }

  filter = (inputText: string) => {
    const filters = inputText.toLowerCase()
                          .split(" ")
                          .filter(text => text.length > 0)

    if(filters.length === 0) {
      this.clearFilter()
    } else {
      this.appliedFilters = filters
      this.filteredRows = this._rows.filter((row,i) => row.filter(filters))
      this.highlightFilter(filters)
    }
  }

  private highlightFilter(filters: string[]) {
    this.filteredRows.forEach((row,i) => {
      const [highlightedRow, rowChanged] = row.highlight(filters)
      if(rowChanged) {
        this.filteredRows[i] = highlightedRow
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

  getHeaders() {
    return this.headers
  }

  get rows() {
    return this.filteredRows
  }

  getHealthColumnIndex() {
    return this.healthColumnIndex
  }

}