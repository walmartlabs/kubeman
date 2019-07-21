/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import ChoiceManager from '../actions/choiceManager'
import {ActionOutput, ActionOutputStyle} from '../actions/actionSpec'
import K8sFunctions from './k8sFunctions';
import StreamLogger from '../logger/streamLogger'
import OutputManager from '../output/outputManager';

export default class K8sPluginHelper {
  static async generateComparisonOutput(action, actionContext, getSelections, onOutput, onStreamOutput, name, ...fields) {
    action.setColumnWidths("20%", "40%", "40%")
    let selections = await getSelections(actionContext)
    if(selections.length < 2) {
      onOutput(["Not enough " + name + " selected"], ActionOutputStyle.Text)
      return
    }
    let output: ActionOutput = []
    const outputHeaders = ["Keys"]
    const outputRows: ActionOutput = []
    outputRows.push(["cluster"])
    const firstItem = selections[0].item
    const outputKeys = firstItem && typeof firstItem !== 'string' ? Object.keys(firstItem).filter(key => key != "yaml") : []
    outputKeys.forEach(key => outputRows.push([key]))

    selections.forEach(selection => {
      outputHeaders.push(selection.item ? selection.item.name || selection.item : 'N/A')
      outputRows[0].push(selection.cluster||'')
      if(selection.item && typeof selection.item !== 'string') {
        outputKeys.forEach((key, index) => outputRows[index+1].push(selection.item[key] ||''))
      }
    })
    onOutput([outputHeaders], "Compare")

    outputRows.forEach((row,i) => {
      const hasAnyValue = row.slice(1).map(value => value && value !== '')
                                .reduce((r1,r2) => r1 || r2, false)
      if(!hasAnyValue) {
        delete outputRows[i]
      }
    })
    output = output.concat(outputRows)
    onStreamOutput(output)
  }

  static async getPodLogs(pods: any[], container: string, k8sClient, tail, rowLimit, historyLimit, onStreamOutput, showOutputLoading, setScrollMode, ...filters) {
    showOutputLoading(true)
    setScrollMode && setScrollMode(false)
    const podRowLimit = Math.ceil((historyLimit || 200)/pods.length)
    StreamLogger.init(rowLimit, onStreamOutput, ...filters)
    filters.length > 0 && OutputManager.filter(filters.join(" "))
  
    for(const pod of pods) {
      const logStream = await K8sFunctions.getPodLog(pod.namespace, pod.name, container, k8sClient, tail, podRowLimit)
      StreamLogger.captureLogStream(pod.name, logStream)
    }
    showOutputLoading(false)
  }

}