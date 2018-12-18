import {DataObject, StringStringArrayMap, ComparisonFunction} from '../util/k8sFunctions'
import ActionContext from '../../src/actions/actionContext'
import {ActionOutput} from '../../src/actions/actionSpec'

export default class K8sComparisonUtil {
  static items: StringStringArrayMap = {}

  static async prepareChoices(actionContext: ActionContext, 
                                    k8sFunction: ComparisonFunction, 
                                    name: string, min: number, max: number, ...fields) {
    const clusters = actionContext.getClusters()
    const k8sClients = actionContext.getK8sClients()
    const namespaces = actionContext.getNamespaces()
    this.items = {}
    const choices: any[] = []
    for(const i in namespaces) {
      const namespace = namespaces[i]
      const nsCluster = namespace.cluster.name
      if(!this.items[namespace.cluster.name]) {
        this.items[namespace.cluster.name] = {}
      }
      if(!this.items[namespace.cluster.name][namespace.name]) {
        this.items[namespace.cluster.name][namespace.name] = []
      }

      const k8sClient = clusters.map((c,i) => c.name === nsCluster ? i : -1)
                                .filter(i => i >= 0).map(i => k8sClients[i])[0]
      
      this.items[namespace.cluster.name][namespace.name] = await k8sFunction(namespace.cluster.name, namespace.name, k8sClient)
      this.items[namespace.cluster.name][namespace.name].forEach(item => {
        const choiceItem: any[] = []
        if(fields.length > 0) {
          fields.forEach(field => choiceItem.push(item[field]))
        } else {
          choiceItem.push(item)
        }
        choiceItem.push("Namespace: " + namespace.name)
        choiceItem.push("Cluster: " + namespace.cluster.name)
        choices.push(choiceItem)
      })
    }
    let howMany = ""
    if(min === max && max > 0) {
      howMany = " " + max + " "
    } else {
      howMany = min > 0 ? " at least " + min : ""
      howMany += max > 0 && min > 0 ? ", and " : ""
      howMany += max > 0 ?  " up to " + max : ""
    }
    actionContext.onChoices && actionContext.onChoices("Choose" + howMany + name + " to compare", choices, min, max)
  }

  static async prepareOutput(actionContext, name, ...fields) {
    let selections = actionContext.getSelections()
    if(selections.length < 2) {
      actionContext.onOutput(["No " + name + " selected"], 'Text')
      return
    }
    selections = selections.map(selection => {
      const data: DataObject = {}
      let lastIndex = 0
      if(fields.length > 0) {
        fields.forEach((field, index) => {
          data[field] = selection[index]
          lastIndex++
        })
      } else {
        data.name = selection[0]
        lastIndex++
      }
      data.namespace = selection[lastIndex].replace("Namespace: ", "")
      data.cluster = selection[lastIndex+1].replace("Cluster: ", "")
      return data
    })
    let output: ActionOutput = []
    const outputHeaders = ["Keys"]
    const outputRows: ActionOutput = []
    outputRows.push(["Cluster"])
    outputRows.push(["Namespace"])

    const firstItem = this.items[selections[0].cluster][selections[0].namespace][0]
    const outputKeys = typeof firstItem !== 'string' ? Object.keys(firstItem) : []
    outputKeys.forEach(key => outputRows.push([key]))

    selections.forEach(selection =>
      this.items[selection.cluster][selection.namespace]
        .filter(item => (item.name || item) === selection.name)
        .forEach(item => {
          outputHeaders.push(item.name || item)
          outputRows[0].push(selection.cluster||'')
          outputRows[1].push(selection.namespace||'')
          if(typeof item !== 'string') {
            outputKeys.forEach((key, index) => outputRows[index+2].push(item[key] ||''))
          }
        }))
    outputRows.forEach((row,i) => {
      const hasAnyValue = row.slice(1).map(value => value && value !== '')
                                .reduce((r1,r2) => r1 || r2, false)
      if(!hasAnyValue) {
        delete outputRows[i]
      }
    })
    output.push(outputHeaders)
    output = output.concat(outputRows)
    actionContext.onOutput(output, "Compare")
  }
}