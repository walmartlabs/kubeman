/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import { ActionOutput } from "../actions/actionSpec"
import FilterUtil, { Filter } from "../util/filterUtil"
import {applyHighlight} from './highlight'

export default class LogOutputManager {
  static title: string = ''
  static output: string[][] = []  
  static filteredOutput: string[][] = []  

  private static rowLimit: number = 0
  private static appliedFilter?: Filter


  static setOutput(output: ActionOutput, rowLimit: number = 100) {
    this.clearContent()
    this.rowLimit = rowLimit
    this.title = output && output.length > 0 && output[0] ? output[0][0] : ''
    this.output = output && output.slice(1)
  }

  static appendOutput(output: ActionOutput) {
    this.output = this.output ? this.output.concat(output) : output
    this.applyFilter()
  }

  static clearContent() {
    this.title = ''
    this.rowLimit = 0
    this.output = []
    this.filteredOutput = []
    this.appliedFilter = undefined
  }

  static clearFilter() {
    this.filteredOutput = this.output
    this.appliedFilter = undefined
  }

  static filter(filterText: string) {
    this.appliedFilter = FilterUtil.createFilter(filterText)
    this.applyFilter()
  }

  static applyFilter() {
    if(this.appliedFilter) {
      this.filteredOutput = this.appliedFilter.filter(this.output)
      this.filteredOutput = this.filteredOutput.map(row => 
        row.map(cell => {
          const highlight = applyHighlight(cell, this.appliedFilter ? this.appliedFilter.text.split("!")[0].split(" ") : [] as string[])
          return highlight.content
        })
      )
    } else {
      this.filteredOutput = this.output
    }
    if(this.rowLimit > 0) {
      this.filteredOutput = this.filteredOutput.slice(-this.rowLimit)
    }
  }

  static get hasContent() {
    return this.output.length > 0 || this.title.length > 0
  }

  static get hasFilteredContent() {
    return this.filteredOutput.length > 0
  }
}