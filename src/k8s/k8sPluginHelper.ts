import _ from 'lodash'
import {DataObject, StringStringArrayMap, GetItemsFunction} from './k8sFunctions'
import ActionContext from '../actions/actionContext'
import {ActionOutput} from '../actions/actionSpec'
import {Cluster, Namespace, Pod, PodTemplate, PodDetails, PodContainerDetails} from "./k8sObjectTypes"
import k8sFunctions from './k8sFunctions'
import { K8sClient } from './k8sClient'

export interface ItemSelection {
  title: string
  namespace: string
  cluster: string
  [key: string]: string
  item?: any
}

export interface PodSelection {
  title: string
  container: string
  pod: string
  podContainerDetails?: PodDetails|PodContainerDetails
  namespace: string
  cluster: string
  k8sClient: K8sClient
}

export default class K8sPluginHelper {
  static items: StringStringArrayMap = {}
  static useNamespace: boolean = true

  static createChoices(items, namespace, cluster, ...fields) {
    const choices: any[] = []
    items.forEach(item => {
      const choiceItem: any[] = []
      if(fields.length > 0) {
        fields.forEach(field => choiceItem.push(item[field]))
      } else {
        choiceItem.push(item.name || item)
      }
      let itemNS = namespace
      if(!itemNS) {
        itemNS = item.namespace ? (item.namespace.name || item.namespace) : ""
      }
      if(itemNS) {
        choiceItem.push("Namespace: " + itemNS)
      }
      choiceItem.push("Cluster: " + cluster)
      choices.push(choiceItem)
    })
    return choices
  }

  private static async storeItems(actionContext: ActionContext, getItems: GetItemsFunction, 
                                  useNamespace: boolean = true, ...fields) {
    const clusters = actionContext.getClusters()
    this.items = {}
    this.useNamespace = useNamespace

    let choices: any[] = []
    for(const cluster of clusters) {
      if(!this.items[cluster.name]) {
        this.items[cluster.name] = {}
      }
      const namespaces = cluster.namespaces
      if(useNamespace && namespaces.length > 0) {
        for(const namespace of namespaces) {
          if(!this.items[cluster.name][namespace.name]) {
            this.items[cluster.name][namespace.name] = []
          }
          const items = this.items[cluster.name][namespace.name] = 
            await getItems(cluster.name, namespace.name, cluster.k8sClient)
          choices = choices.concat(this.createChoices(items, namespace.name, cluster.name, ...fields))
        }
      } else {
        const items = await getItems(cluster.name, undefined, cluster.k8sClient)
        items.forEach(item => {
          const namespace = item.namespace ? (item.namespace.name || item.namespace) : ""
          if(!this.items[cluster.name][namespace]) {
            this.items[cluster.name][namespace] = []
          }
          this.items[cluster.name][namespace].push(item)
        })
        choices = choices.concat(this.createChoices(items, undefined, cluster.name, ...fields))
      }
    }
    return choices
  }

  static async prepareChoices(actionContext: ActionContext, k8sFunction: GetItemsFunction, 
                              name: string, min: number, max: number, useNamespace: boolean = true, ...fields) {
    const choices: any[] = await K8sPluginHelper.storeItems(actionContext, k8sFunction, useNamespace, ...fields)
    let howMany = ""
    if(min === max && max > 0) {
      howMany = " " + max + " "
    } else {
      howMany = min > 0 ? " at least " + min : ""
      howMany += max > 0 && min > 0 ? ", and " : ""
      howMany += max > 0 ?  " up to " + max + " " : ""
    }
    actionContext.onActionInitChoices && actionContext.onActionInitChoices("Choose" + howMany + name, choices, min, max)
  }

  static getSelections(actionContext: ActionContext, ...fields) : ItemSelection[] {
    let selections = actionContext.getSelections()
    selections = selections.map(selection => {
      const data: DataObject = {}
      let lastIndex = 0
      let keyField = 'name'
      if(fields.length > 0) {
        keyField = fields[0]
        fields.forEach((field, index) => {
          data[field] = selection[index]
          lastIndex++
        })
      } else {
        data.name = selection[0]
        lastIndex++
      }
      data.title = data.name || selection[0]
      if(this.useNamespace && selection[lastIndex].includes("Namespace")) {
        data.namespace = selection[lastIndex].replace("Namespace: ", "")
        lastIndex++
      } else {
        data.namespace = ""
      }
      data.cluster = selection[lastIndex].replace("Cluster: ", "")
      const items = K8sPluginHelper.items[data.cluster][data.namespace] ?
                  K8sPluginHelper.items[data.cluster][data.namespace]
                    .filter(item => (item[keyField] || item) === data.title) : []
      items.length > 0 && (data.item = items[0])
      return data
    })
    return selections
  }

  static async chooseClusters(actionContext: ActionContext) {
    const clusters = actionContext.getClusters()
    const choices: any[] = []
    clusters.forEach(cluster => {
      choices.push([cluster.name])
    })
    if(clusters.length > 2) {
      actionContext.onActionInitChoices && actionContext.onActionInitChoices("Choose 2 Clusters", choices, 2, 2)
    } else {
      actionContext.context && (actionContext.context.selections = choices)
      actionContext.onSkipChoices && actionContext.onSkipChoices()
    }
  }

  static getSelectedClusters(actionContext: ActionContext) : Cluster[] {
    const selections = _.flatten(actionContext.getSelections())
    const clusters = actionContext.getClusters()
    return selections.map(s => clusters.filter(cluster => cluster.name === s)[0])
  }

  static async chooseNamespaces(min: number = 1, max: number = 5, actionContext: ActionContext) {
    const clusters = actionContext.getClusters()
    let namespaces = actionContext.getNamespaces()
    if(namespaces.length < min || namespaces.length > max) {
      K8sPluginHelper.prepareChoices(actionContext, 
        async (clusterName, namespace, k8sClient) => {
          if(namespaces.length < min) {
            return k8sFunctions.getClusterNamespaces(k8sClient)
          } else {
            const cluster = actionContext.context ? actionContext.context.cluster(clusterName) : undefined
            return cluster ? cluster.namespaces : []
          }
        },
      "Namespaces", min, max, false, "name")
    } else {
      const selections = await K8sPluginHelper.storeItems(actionContext, async (cluster, namespace, k8sClient) => {
        return namespaces.filter(ns => ns.cluster.name === cluster)
      }, false, "name")
      actionContext.context && (actionContext.context.selections = selections)
      actionContext.onSkipChoices && actionContext.onSkipChoices()
    }
  }

  static async choosePod(min: number = 1, max: number = 1, chooseContainers: boolean = false, 
                          loadDetails: boolean = false, actionContext: ActionContext) {
    const contextPods = actionContext.getPods()
    const containers = _.flatMap(contextPods, pod => pod.containers)
    const contextHasLess = chooseContainers ? containers.length < min : contextPods.length < min
    const contextHasMore = chooseContainers ? containers.length > max : contextPods.length > max
    if(contextHasLess || contextHasMore) {
      K8sPluginHelper.prepareChoices(actionContext, 
        async (cluster, namespace, k8sClient) => {
          let pods : any[] = []
          if(contextHasLess) {
            pods = namespace ? await k8sFunctions.getAllPodsForNamespace(namespace, k8sClient) : []
          } else {
            const namespaces = actionContext.getNamespaces()
            pods = _.flatMap(
                    namespaces.filter(ns => ns.cluster.name === cluster && ns.name === namespace),
                    ns => ns.pods)
            if(loadDetails) {
              for(const i in pods) {
                pods[i] = namespace ? await k8sFunctions.getPodDetails(namespace, pods[i].name, k8sClient) : undefined
              }
            }
          }
          if(chooseContainers) {
            pods = _.flatMap(pods, pod => pod.containers.map(c => {
              return {
                ...pod,
                name: (c.name ? c.name : c)+"@"+pod.name,
              }
            }))
          }
          return pods
        },
        chooseContainers ? "Container@Pod" : "Pod(s)", min, max, true, "name"
      )
    } else {
      const selections = await K8sPluginHelper.storeItems(actionContext, async (clusterName, nsName, k8sClient) => {
        const cluster = actionContext.context && actionContext.context.cluster(clusterName)
        const namespace = cluster && nsName && cluster.namespace(nsName)
        let pods: any[] = namespace ? namespace.pods : []
        if(namespace && loadDetails) {
          for(const i in pods) {
            pods[i] = await k8sFunctions.getPodDetails(namespace.name, pods[i].name, k8sClient)
          }
        }
        if(chooseContainers) {
          pods = _.flatMap(pods, pod => pod.containers.map(c => {
            return {
              ...pod,
              name: (c.name ? c.name : c)+"@"+pod.name,
            }
          }))
        }
        return Promise.resolve(pods)
      }, true, "name")
      actionContext.context && (actionContext.context.selections = selections)
      actionContext.onSkipChoices && actionContext.onSkipChoices()
    }
  }

  static async getPodSelections(actionContext: ActionContext, loadDetails: boolean = false, loadContainers: boolean = true) {
    const selections = actionContext.getSelections()
    const pods : PodSelection[] = []
    for(const selection of selections) {
      const namespace = selection[1].replace("Namespace: ", "")
      const cluster = selection[2].replace("Cluster: ", "")
      const clusters = actionContext.getClusters()
      const k8sClient = clusters.filter(c => c.name === cluster)
                                  .map(cluster => cluster.k8sClient)[0]
      const title = selection[0].name ? selection[0].name : selection[0] as string
      const podAndContainer = loadContainers ? title.split("@") : undefined
      const container = loadContainers ? podAndContainer[0] : undefined
      const pod = loadContainers ? podAndContainer[1] : title

      const podContainerDetails : PodDetails|PodContainerDetails|undefined = loadDetails ? 
              loadContainers ? await k8sFunctions.getContainerDetails(namespace, pod, container, k8sClient) 
                              : await k8sFunctions.getPodDetails(namespace, pod, k8sClient)
                              : undefined
      pods.push({
        title,
        container,
        pod,
        podContainerDetails,
        namespace,
        cluster,
        k8sClient
      })
    }
    return pods
  }

  static async chooseCRDs(min: number = 1, max: number = 10, actionContext: ActionContext) {
    const clustersReported: string[] = []
    await K8sPluginHelper.prepareChoices(actionContext, 
      async (cluster, namespace,k8sClient) => {
        if(!clustersReported.includes(cluster)) {
          clustersReported.push(cluster)
          return await k8sFunctions.getClusterCRDs(k8sClient)
        } else {
          return []
        }
      }, "CRDs", 1, 10, false, "name")

  }

  static async generateComparisonOutput(actionContext, onOutput, name, ...fields) {
    let selections = K8sPluginHelper.getSelections(actionContext, ...fields)
    if(selections.length < 2) {
      onOutput(["No " + name + " selected"], 'Text')
      return
    }
    let output: ActionOutput = []
    const outputHeaders = ["Keys"]
    const outputRows: ActionOutput = []
    outputRows.push(["cluster"])
    const firstItem = selections[0].item
    const outputKeys = firstItem && typeof firstItem !== 'string' ? Object.keys(firstItem) : []
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
}