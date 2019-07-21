/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import hljs from 'highlight.js/lib/highlight'
import yamlHighlight from 'highlight.js/lib/languages/yaml'
import StringBuffer from '../util/stringbuffer'
import {appTheme} from '../theme/theme'
import 'highlight.js/styles/github.css'


hljs.registerLanguage('yaml', yamlHighlight)

export function applyHighlight(text: string, filters: string[]) {
  const highlightColor = appTheme.activeTheme.palette && 
          appTheme.activeTheme.palette.type === 'dark' ? '#FF7788' : '#FFCC80'

  const lowerText = text.toLowerCase()
  const matchPositions : Set<number> = new Set
  let changed = false
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
      changed = true
    }
  })
  if(startPos >= 0) {
    let highlightedText = "<span style='color: #000; background-color:" + highlightColor + "'>" 
                          + text.slice(startPos, endPos+1) 
                          + "</span>"
    sb.append(highlightedText)
    changed = true
  }
  sb.append(text.slice(endPos+1))
  return {content: sb.toString(), changed}
}
