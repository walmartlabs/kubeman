import _ from 'lodash'
import {DataObject, StringStringArrayMap, ComparisonFunction} from '../../src/k8s/k8sFunctions'
import ActionContext from '../../src/actions/actionContext'
import {ActionOutput} from '../../src/actions/actionSpec'
import {Namespace, Pod, PodTemplate} from "../../src/k8s/k8sObjectTypes"
import k8sFunctions from '../../src/k8s/k8sFunctions'

export default class K8sPluginHelper {
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
    actionContext.onChoices && actionContext.onChoices("Choose" + howMany + name, choices, min, max)
  }

  static async generateComparisonOutput(actionContext, name, ...fields) {
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

  static async choosePod(actionContext: ActionContext) {
    K8sPluginHelper.prepareChoices(actionContext, 
      async (cluster, namespace, k8sClient) => {
        const namespaces = actionContext.getNamespaces()
        let pods = _.flatMap(namespaces.filter(ns => 
          ns.cluster.name === cluster && ns.name === namespace),
          (ns: Namespace) => 
          _.flatMap(ns.pods, pod => pod.containers.map(c => c+"@"+pod.name)))
        //TBD: Whether or not support selecting from all pods if no pods in the context for the namespace
        // if(!pods || pods.length === 0) {
        //   pods = await k8sFunctions.getAllPodsForNamespace(namespace, k8sClient)
        //   pods = _.flatMap(pods, pod => pod.containers.map(c => c.name+"@"+pod.name))
        // }
        return Promise.resolve(pods)
      },
    "Container@Pod", 1, 1)
  }
}