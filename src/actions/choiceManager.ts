import _ from 'lodash'
import K8sFunctions, {StringStringArrayMap, GetItemsFunction} from '../k8s/k8sFunctions'
import {Cluster, PodDetails, PodContainerDetails} from "../k8s/k8sObjectTypes"
import { K8sClient } from '../k8s/k8sClient'
import ActionContext from './actionContext'
import {Choice} from './actionSpec'
import Context from "../context/contextStore";

export interface ItemSelection {
  title: string
  namespace: string
  cluster: string
  [key: string]: string
  item?: any
}

export interface PodSelection {
  title: string
  containerName: string
  podName: string
  podContainerDetails?: PodDetails|PodContainerDetails
  namespace: string
  cluster: string
  k8sClient: K8sClient
}

export default class ChoiceManager {
  static clearSelectionsDelay = 180000
  static items: StringStringArrayMap = {}
  static useNamespace: boolean = true
  static showChoiceSubItems: boolean = true
  static cacheKey: string|undefined = undefined
  static pendingChoicesCounter = 0
  static clearItemsTimer: any = undefined

  static startClearItemsTimer() {
    if(this.clearItemsTimer) {
      clearTimeout(this.clearItemsTimer)
    }
    this.clearItemsTimer = setTimeout(this.clear.bind(this), this.clearSelectionsDelay)
  }

  static clear() {
    this.items = {}
    this.useNamespace = true
    this.showChoiceSubItems = true
    this.cacheKey = undefined
    this.clearItemsTimer = undefined
    this.pendingChoicesCounter = 0
    Context.selections = []
  }

  static createChoices(items, namespace, cluster, ...fields) {
    const choices: Choice[] = []
    items && items.forEach(item => {
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

  private static async _createAndStoreItems(cache: boolean, cacheKey: string|undefined, 
                                    actionContext: ActionContext, getItems: GetItemsFunction, 
                                    useNamespace: boolean = true, ...fields) {
    const clusters = actionContext.getClusters()
    this.useNamespace = useNamespace
    const isCached = this.cacheKey === cacheKey
    if(cache) {
      if(!cacheKey || !isCached) {
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

    const operationId = Context.operationCounter
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
          if(operationId !== Context.operationCounter) {
            return []
          }
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

  static async storeItems(actionContext: ActionContext, getItems: GetItemsFunction, 
                                   useNamespace: boolean = true, ...fields) {
    return this._createAndStoreItems(false, undefined, actionContext, getItems, useNamespace, ...fields)
  }

  static async storeCachedItems(cacheKey: string, actionContext: ActionContext, getItems: GetItemsFunction, 
                                          useNamespace: boolean = true, ...fields) {
    return this._createAndStoreItems(true, cacheKey, actionContext, getItems, useNamespace, ...fields)
  }

  static async _prepareChoices(cache: boolean, cacheKey: string|undefined, actionContext: ActionContext, k8sFunction: GetItemsFunction, 
                              name: string, min: number, max: number, useNamespace: boolean = true, ...fields) {
    const operationId = Context.operationCounter
    ++this.pendingChoicesCounter
    const previousSelections = cache && this.cacheKey === cacheKey ? actionContext.getSelections() : []
    this.cacheKey !== cacheKey && (Context.selections = [])
    const choices: any[] = await ChoiceManager._createAndStoreItems(cache, cacheKey, actionContext, k8sFunction, useNamespace, ...fields)
    if(choices.length >= min && choices.length <= max) {
      Context.selections = choices
      actionContext.onSkipChoices && actionContext.onSkipChoices()
    } else {
      let howMany = ""
      if(min === max && max > 0) {
        howMany = " " + max + " "
      } else {
        howMany = min > 0 ? " at least " + min : ""
        howMany += max > 0 && min > 0 ? ", and " : ""
        howMany += max > 0 ?  " up to " + max + " " : ""
      }
      //show dialog only if no other operation has been performed by the user in the meantime
      if(operationId === Context.operationCounter) {
        actionContext.onActionInitChoices && 
          actionContext.onActionInitChoices("Choose" + howMany + name, choices, min, max, 
                                            ChoiceManager.showChoiceSubItems, previousSelections)
      } else if(--this.pendingChoicesCounter === 0) {
        actionContext.onCancelActionChoice && actionContext.onCancelActionChoice()
      }
    }
  }

  static async prepareChoices(actionContext: ActionContext, k8sFunction: GetItemsFunction, 
                              name: string, min: number, max: number, useNamespace: boolean = true, ...fields) {
    return this._prepareChoices(false, undefined, actionContext, k8sFunction, name, min, max, useNamespace, ...fields)
  }

  static async prepareCachedChoices(actionContext: ActionContext, k8sFunction: GetItemsFunction, 
                              name: string, min: number, max: number, useNamespace: boolean = true, ...fields) {
    return this._prepareChoices(true, name, actionContext, k8sFunction, name, min, max, useNamespace, ...fields)
  }

  static onActionChoiceCompleted() {
    this.startClearItemsTimer()
  }

  static getSelections(actionContext: ActionContext) : ItemSelection[] {
    return actionContext.getSelections().map(selection => selection.data)
  }

  static getDoubleSelections(actionContext: ActionContext) : ItemSelection[][] {
    return actionContext.getSelections().map(selection => selection.data)
  }

  static async chooseClusters(min: number = 2, max: number = 3, actionContext: ActionContext) {
    const clusters = actionContext.getClusters()
    const getCluster = async (cluster) => [Context.cluster(cluster)]
    if(clusters.length > max) {
      ChoiceManager.showChoiceSubItems = false
      await ChoiceManager.prepareChoices(actionContext, getCluster, "Clusters", min, max, false, "name")
      ChoiceManager.showChoiceSubItems = true
    } else {
      Context.selections = await ChoiceManager.storeItems(actionContext, getCluster, false, "name")
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
      namespaceNames = [] //reset for use by uniqueFilter
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
      await ChoiceManager.prepareCachedChoices(actionContext,
        async (clusterName, namespace, k8sClient) => namespaces.filter(ns => ns.cluster.name === clusterName),
        "Namespaces", min, max, false, "name")
        ChoiceManager.showChoiceSubItems = true
    } else {
      Context.selections = await ChoiceManager.storeCachedItems("namespaces", actionContext, 
        async (cluster, namespace, k8sClient) => namespaces.filter(ns => ns.cluster.name === cluster), false, "name")
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

  static async choosePods(min: number = 1, max: number = 1, chooseContainers: boolean = false, 
                          loadDetails: boolean = false, actionContext: ActionContext) {
    ChoiceManager.prepareCachedChoices(actionContext, 
      async (cluster, namespace, k8sClient) => {
        let pods : any[] = namespace ? await K8sFunctions.getAllPodsForNamespace(namespace, k8sClient) : []
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
  }

  static async chooseServicePods(serviceName: string, serviceNamespace: string, 
                                min: number = 1, max: number = 1, chooseContainers: boolean = false, 
                                loadDetails: boolean = false, actionContext: ActionContext) {
    ChoiceManager.prepareCachedChoices(actionContext, 
      async (cluster, namespace, k8sClient) => {
        let podsAndContainers = await K8sFunctions.getPodsAndContainersForServiceName(serviceName, serviceNamespace, k8sClient, true)
        let pods = podsAndContainers.pods as any[]
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
      chooseContainers ? "Container@Pod" : "Pod(s)", min, max, false, "name"
    )
  }

  static async getPodSelections(actionContext: ActionContext, loadContainers: boolean = true) {
    const selections = actionContext.getSelections()
    const podSelections : PodSelection[] = []
    for(const selection of selections) {
      const namespace = selection.data.namespace
      const clusters = actionContext.getClusters()
      const k8sClient = clusters.filter(c => c.name === selection.data.cluster)
                                .map(cluster => cluster.k8sClient)[0]
      const title = selection.data.name || selection.data.title
      const podAndContainerName = loadContainers ? title.split("@") : undefined
      const containerName = loadContainers ? podAndContainerName[0] : undefined
      const podName = loadContainers ? podAndContainerName[1] : title
      const podContainerDetails = loadContainers ? 
            await K8sFunctions.getContainerDetails(namespace, podName, containerName, k8sClient) : selection.data.item
      selection.data.podName = podName
      selection.data.containerName = containerName
      selection.data.podContainerDetails = podContainerDetails
      selection.data.k8sClient = k8sClient
      podSelections.push(selection.data)
    }
    return podSelections
  }

  static async chooseService(min, max, actionContext) {
    ChoiceManager.prepareCachedChoices(actionContext, K8sFunctions.getServices, "Services", min, max, true, "name")
  }

  static async chooseServiceContainer(serviceName: string, serviceNamespace: string, serviceCluster: string, actionContext: ActionContext) {
    ChoiceManager.prepareCachedChoices(actionContext, 
      async (cluster, namespace, k8sClient) => {
        if(cluster === serviceCluster) {
          let podsAndContainers = await K8sFunctions.getPodsAndContainersForServiceName(serviceName, serviceNamespace, k8sClient, true)
          return podsAndContainers.containers as any[]
        } else {
          return []
        }
      },
      "Container(s)", 1, 1, false, "name"
    )
  }

  static async chooseServiceAndContainer(action, actionContext: ActionContext) {
    await ChoiceManager.doubleChoices(action, actionContext,
      await ChoiceManager.chooseService.bind(ChoiceManager, 1, 1, actionContext),
      await ChoiceManager.getSelections.bind(ChoiceManager, actionContext),
      async serviceSelection => {
        const service = serviceSelection.data[0].item
        await ChoiceManager.chooseServiceContainer(service.name, service.namespace, serviceSelection.data[0].cluster, actionContext)
      },
      await ChoiceManager.getSelections.bind(ChoiceManager, actionContext)
    )
  }

  static async doubleChoices(action, actionContext, choose1, getSelections1, choose2, getSelections2) {
    let selections: any[] = []
    const choice2SelectionHandler = async (...args) => {
      selections.push({data: await getSelections2()})
      Context.selections = selections
      action.act(actionContext)
    }
    const choice1SelectionHandler = async (...args) => {
      selections.push({data: await getSelections1()})
      actionContext.onSkipChoices = choice2SelectionHandler
      actionContext.onActionInitChoices = actionContext.onActionInitChoicesUnbound.bind(actionContext, choice2SelectionHandler)
      await choose2(selections[0])
    }
    actionContext.onSkipChoices = choice1SelectionHandler
    actionContext.onActionInitChoices = actionContext.onActionInitChoicesUnbound.bind(actionContext, choice1SelectionHandler)
    await choose1()
  }
}
