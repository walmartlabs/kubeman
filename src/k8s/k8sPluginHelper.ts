import _ from 'lodash'
import ChoiceManager from '../actions/choiceManager'
import {ActionOutput, ActionOutputStyle} from '../actions/actionSpec'
import K8sFunctions from './k8sFunctions';
import StreamLogger from '../logger/streamLogger'
import OutputManager from '../output/outputManager';

export default class K8sPluginHelper {
  static async generateComparisonOutput(actionContext, onOutput, name, ...fields) {
    let selections = ChoiceManager.getSelections(actionContext)
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
    outputRows.forEach((row,i) => {
      const hasAnyValue = row.slice(1).map(value => value && value !== '')
                                .reduce((r1,r2) => r1 || r2, false)
      if(!hasAnyValue) {
        delete outputRows[i]
      }
    })
    output.push(outputHeaders)
    output = output.concat(outputRows)
    onOutput(output, "Compare")
  }

  static async tailPodLogs(pods: any[], container: string, k8sClient, rowLimit, onStreamOutput, showOutputLoading, setScrollMode, ...filters) {
    showOutputLoading(true)
    setScrollMode(false)
    const podRowLimit = Math.ceil((rowLimit || 200)/pods.length)
    StreamLogger.init(rowLimit, onStreamOutput, ...filters)
    filters.length > 0 && OutputManager.filter(filters.join(" "))
  
    for(const pod of pods) {
      const logStream = await K8sFunctions.getPodLog(pod.namespace, pod.name, container, k8sClient, true, podRowLimit)
      StreamLogger.captureLogStream(pod.name, logStream)
    }
    showOutputLoading(false)
  }

}