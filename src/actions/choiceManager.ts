import _ from 'lodash'
import K8sFunctions, {StringStringArrayMap, GetItemsFunction} from '../k8s/k8sFunctions'
import {Cluster, Namespace, Pod, PodTemplate, PodDetails, PodContainerDetails} from "../k8s/k8sObjectTypes"
import { K8sClient } from '../k8s/k8sClient'
import ActionContext from './actionContext'
import {ActionOutput, ActionOutputStyle, Choice} from './actionSpec'

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

export default class ChoiceManager {
  static clearSelectionsDelay = 600000
  static items: StringStringArrayMap = {}
  static useNamespace: boolean = true
  static showChoiceSubItems: boolean = true
  static cacheKey: string|undefined = undefined
  static clearItemsTimer: any = undefined

  static startClearItemsTimer() {
    if(this.clearItemsTimer) {
      clearTimeout(this.clearItemsTimer)
    }
    this.clearItemsTimer = setTimeout(() => {
      this.items = {}
      this.useNamespace = true
      this.cacheKey = undefined
      this.clearItemsTimer = undefined
    }, this.clearSelectionsDelay)
  }

  static createChoices(items, namespace, cluster, ...fields) {
    const choices: Choice[] = []
    items.forEach(item => {
      const choiceItem: any[] = []
      const choiceData: any = {}
      if(fields.length > 0) {
        fields.forEach(field => {
          choiceItem.push(item[field])
          choiceData[field] = item[field]
        })
        choiceData['title'] = choiceData['name'] || choiceItem[0]
      } else {
        const itemName = item.name || item
        choiceItem.push(itemName)
        choiceData['title'] = choiceData['name'] = itemName
      }
      let itemNS = namespace
      if(!itemNS) {
        itemNS = item.namespace ? (item.namespace.name || item.namespace) : ""
      }
      if(itemNS) {
        choiceItem.push("Namespace: " + itemNS)
      }
      choiceItem.push("Cluster: " + cluster)
      choiceData.cluster = cluster
      choiceData.namespace = itemNS
      choiceData.item = item
      choices.push({displayItem: choiceItem, data: choiceData})
    })
    return choices
  }

  private static async _storeItems(cache: boolean, cacheKey: string|undefined, 
                                    actionContext: ActionContext, getItems: GetItemsFunction, 
                                    useNamespace: boolean = true, ...fields) {
    const clusters = actionContext.getClusters()
    this.useNamespace = useNamespace
    const isCached = this.cacheKey === cacheKey
    if(cache) {
      if(!cacheKey || !isCached) {
        this.startClearItemsTimer()
        this.cacheKey = cacheKey
        this.items = {}
      } else {
        Object.keys(this.items).forEach(c => {
          const cluster = clusters.filter(cluster => cluster.name === c)[0]
          if(!cluster) {
            delete this.items[c]
          } else if(useNamespace) {
            if(cluster.namespaces.length > 0) {
              Object.keys(this.items[c]).forEach(ns => {
                if(cluster.namespaces.filter(namespace => namespace.name === ns).length === 0) {
                  delete this.items[c][ns]
                }
              })
            }
          }
        })
      }
    } else {
      this.cacheKey = undefined
      this.items = {}
    }

    let choices: any[] = []
    for(const cluster of clusters) {
      if(!this.items[cluster.name]) {
        this.items[cluster.name] = {}
      }
      let namespaces = cluster.namespaces
      if(useNamespace) {
        if(namespaces.length === 0) {
          namespaces = await K8sFunctions.getClusterNamespaces(cluster.k8sClient)
        }
        for(const namespace of namespaces) {
          let isNewNamespace = false
          if(!this.items[cluster.name][namespace.name]) {
            this.items[cluster.name][namespace.name] = []
            isNewNamespace = true
          }
          let items = this.items[cluster.name][namespace.name]
          if(!cache || !isCached || isNewNamespace) {
            items = this.items[cluster.name][namespace.name] = await getItems(cluster.name, namespace.name, cluster.k8sClient)
          }
          choices = choices.concat(this.createChoices(items, namespace.name, cluster.name, ...fields))
        }
      } else {
        const clusterItems = this.items[cluster.name]
        if(!cache || Object.values(clusterItems).length === 0) {
          const items = await getItems(cluster.name, undefined, cluster.k8sClient)
          items.forEach(item => {
            const namespace = item.namespace ? (item.namespace.name || item.namespace) : ""
            if(!clusterItems[namespace]) {
              clusterItems[namespace] = []
            }
            clusterItems[namespace].push(item)
          })
        }
        Object.keys(clusterItems).forEach(ns => {
          choices = choices.concat(this.createChoices(clusterItems[ns], undefined, cluster.name, ...fields))
        })
      }
    }
    choices = choices.sort((c1, c2) => {
      let result = c1.displayItem[0].localeCompare(c2.displayItem[0])
      if(result === 0 && c1.displayItem.length > 1) {
        result = c1.displayItem[1].localeCompare(c2.displayItem[1])
      }
      return result
    })
    return choices
  }

  private static async storeItems(actionContext: ActionContext, getItems: GetItemsFunction, 
                                   useNamespace: boolean = true, ...fields) {
    return this._storeItems(false, undefined, actionContext, getItems, useNamespace, ...fields)
  }

  private static async storeCachedItems(cacheKey: string, actionContext: ActionContext, getItems: GetItemsFunction, 
                                          useNamespace: boolean = true, ...fields) {
    return this._storeItems(true, cacheKey, actionContext, getItems, useNamespace, ...fields)
  }

  static async _prepareChoices(cache: boolean, cacheKey: string|undefined, actionContext: ActionContext, k8sFunction: GetItemsFunction, 
                              name: string, min: number, max: number, useNamespace: boolean = true, ...fields) {
    const previousSelections = this.cacheKey === cacheKey ? actionContext.getSelections() : []
    const choices: any[] = await ChoiceManager._storeItems(cache, cacheKey, actionContext, k8sFunction, useNamespace, ...fields)
    let howMany = ""
    if(min === max && max > 0) {
      howMany = " " + max + " "
    } else {
      howMany = min > 0 ? " at least " + min : ""
      howMany += max > 0 && min > 0 ? ", and " : ""
      howMany += max > 0 ?  " up to " + max + " " : ""
    }
    actionContext.onActionInitChoices && 
      actionContext.onActionInitChoices("Choose" + howMany + name, choices, min, max, 
                                        ChoiceManager.showChoiceSubItems, previousSelections)
  }

  static async prepareChoices(actionContext: ActionContext, k8sFunction: GetItemsFunction, 
                              name: string, min: number, max: number, useNamespace: boolean = true, ...fields) {
    return this._prepareChoices(false, undefined, actionContext, k8sFunction, name, min, max, useNamespace, ...fields)
  }

  static async prepareCachedChoices(actionContext: ActionContext, k8sFunction: GetItemsFunction, 
                              name: string, min: number, max: number, useNamespace: boolean = true, ...fields) {
    return this._prepareChoices(true, name, actionContext, k8sFunction, name, min, max, useNamespace, ...fields)
  }

  static getSelections(actionContext: ActionContext) : ItemSelection[] {
    return actionContext.getSelections().map(selection => selection.data)
  }

  static async chooseClusters(actionContext: ActionContext, min: number = 2, max: number = 3) {
    const clusters = actionContext.getClusters()
    const context = actionContext.context
    const getCluster = async (cluster) => [context && context.cluster(cluster)]
    if(clusters.length > max) {
      ChoiceManager.showChoiceSubItems = false
      await ChoiceManager.prepareChoices(actionContext, getCluster, "Clusters", min, max, false, "name")
      ChoiceManager.showChoiceSubItems = true
    } else {
      const selections = await ChoiceManager.storeItems(actionContext, getCluster, false, "name")
      actionContext.context && (actionContext.context.selections = selections)
      actionContext.onSkipChoices && actionContext.onSkipChoices()
    }
  }

  static getSelectedClusters(actionContext: ActionContext) : Cluster[] {
    return this.getSelections(actionContext).map(s => s.item) as Cluster[]
  }


  static async chooseCRDs(min: number = 1, max: number = 5, actionContext: ActionContext) {
    ChoiceManager.prepareCachedChoices(actionContext, 
      async (cluster, namespace,k8sClient) => {
        return K8sFunctions.getClusterCRDs(k8sClient)
      }, "CRDs", min, max, false, "name")
  }

  static async _chooseNamespaces(clusters: Cluster[], unique: boolean, min: number, max: number, actionContext: ActionContext) {
    const clusterNames = clusters.map(c => c.name)
    let namespaces = actionContext.getNamespaces().filter(ns => clusterNames.includes(ns.cluster.name))
    let namespaceNames: string[] = []
    const uniqueFilter = ns => {
      if(namespaceNames.includes(ns.name)) {
        return false
      } else {
        namespaceNames.push(ns.name)
        return true
      }
    }
    if(unique) {
      namespaces = namespaces.filter(uniqueFilter)
    }
    if(namespaces.length < min) {
      namespaces = []
      namespaceNames = []
      for(const cluster of clusters) {
        let clusterNamespaces = await K8sFunctions.getClusterNamespaces(cluster.k8sClient)
        if(unique) {
          clusterNamespaces = clusterNamespaces.filter(uniqueFilter)
        }
        namespaces = namespaces.concat(clusterNamespaces.map(ns => {
          ns.cluster = cluster
          return ns
        }))
      }
    }
    if(namespaces.length < min || namespaces.length > max) {
      ChoiceManager.showChoiceSubItems = !unique
      await ChoiceManager.prepareChoices(actionContext, 
        async (clusterName, namespace, k8sClient) => namespaces.filter(ns => ns.cluster.name === clusterName),
        "Namespaces", min, max, false, "name")
        ChoiceManager.showChoiceSubItems = true
    } else {
      const selections = await ChoiceManager.storeItems(actionContext, 
        async (cluster, namespace, k8sClient) => namespaces.filter(ns => ns.cluster.name === cluster), false, "name")
      actionContext.context && (actionContext.context.selections = selections)
      actionContext.onSkipChoices && actionContext.onSkipChoices()
    }
  }
  
  static async chooseNamespaces(unique: boolean, min: number, max: number, actionContext: ActionContext) {
    return ChoiceManager._chooseNamespaces(actionContext.getClusters(), unique, min, max, actionContext)
  }

  static async chooseNamespacesWithIstio(unique: boolean = false, min: number = 1, max: number = 5, actionContext: ActionContext) {
    const clusters = actionContext.getClusters().filter(c => c.hasIstio)
    return ChoiceManager._chooseNamespaces(clusters, unique, min, max, actionContext)
  }

  static async choosePod(min: number = 1, max: number = 1, chooseContainers: boolean = false, 
                          loadDetails: boolean = false, actionContext: ActionContext) {
    const contextPods = actionContext.getPods()
    const containers = _.flatMap(contextPods, pod => pod.containers)
    const contextHasLess = chooseContainers ? containers.length < min : contextPods.length < min
    const contextHasMore = chooseContainers ? containers.length > max : contextPods.length > max
    if(contextHasLess || contextHasMore) {
      ChoiceManager.prepareCachedChoices(actionContext, 
        async (cluster, namespace, k8sClient) => {
          let pods : any[] = []
          if(contextHasLess) {
            pods = namespace ? await K8sFunctions.getAllPodsForNamespace(namespace, k8sClient) : []
          } else {
            const namespaces = actionContext.getNamespaces()
            pods = _.flatMap(
                    namespaces.filter(ns => ns.cluster.name === cluster && ns.name === namespace),
                    ns => ns.pods)
            if(loadDetails) {
              for(const i in pods) {
                pods[i] = namespace ? await K8sFunctions.getPodDetails(namespace, pods[i].name, k8sClient) : undefined
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
      const selections = await ChoiceManager.storeItems(actionContext, async (clusterName, nsName, k8sClient) => {
        const cluster = actionContext.context && actionContext.context.cluster(clusterName)
        const namespace = cluster && nsName && cluster.namespace(nsName)
        let pods: any[] = namespace ? namespace.pods : []
        if(namespace && loadDetails) {
          for(const i in pods) {
            pods[i] = await K8sFunctions.getPodDetails(namespace.name, pods[i].name, k8sClient)
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
      const namespace = selection.data.namespace
      const cluster = selection.data.cluster
      const clusters = actionContext.getClusters()
      const k8sClient = clusters.filter(c => c.name === cluster)
                                  .map(cluster => cluster.k8sClient)[0]
      const title = selection.data.name || selection.data.title
      const podAndContainer = loadContainers ? title.split("@") : undefined
      const container = loadContainers ? podAndContainer[0] : undefined
      const pod = loadContainers ? podAndContainer[1] : title

      const podContainerDetails : PodDetails|PodContainerDetails|undefined = loadDetails ? 
              loadContainers ? await K8sFunctions.getContainerDetails(namespace, pod, container, k8sClient) 
                              : await K8sFunctions.getPodDetails(namespace, pod, k8sClient)
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
}