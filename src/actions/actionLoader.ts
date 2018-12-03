import fs from 'fs'
import path from 'path'

import {ActionCategory, ActionGroupSpec, ActionGroupSpecs, isActionGroupSpec, 
        methodGetClusters, methodGetK8sClients, isClusterActionSpec, isNamespaceActionSpec,
        ActionOutput, ActionOutputStyle, } from './actionSpec'
import Context from "../context/contextStore";
import {Cluster, Namespace, Pod, Item} from "../k8s/contextObjectTypes";
import * as k8s from '../k8s/k8sClient'
import actions from './actions';


const actionPluginFolder = "plugins"

export class ActionLoader {

  static onLoad: (ActionGroupSpecs) => void
  static onOutput: (ActionOutput, ActionOutputStyle) => void
  static context: Context

  static setContext(context: Context) {
    this.context = context
  }

  static setOnLoad(callback: (ActionGroupSpecs) => void) {
    this.onLoad = callback
  }

  static setOnOutput(callback: (ActionOutput, ActionOutputStyle) => void) {
    this.onOutput = callback
  }

  static loadActionPlugins() {
    let actionGroupsMap : Map<string, ActionGroupSpec> = new Map
    this.addReloadAction(actionGroupsMap)

    const modulePath = path.join(__dirname, actionPluginFolder)

    fs.readdir(modulePath, (err, files) => {
      if(err && err.code) {
        console.log("Failed to load plugins: " + err)
      } else {
        files.forEach(filename => {
          const filePath =  path.join(path.resolve(__dirname), actionPluginFolder, filename)
          const globalRequire = global['require']
          delete globalRequire.cache[globalRequire.resolve(filePath)]
          const actionGroupSpec = globalRequire(filePath)
          if(isActionGroupSpec(actionGroupSpec)) {
            ActionLoader.configureActions(actionGroupSpec)
            const existingSpec = actionGroupsMap.get(actionGroupSpec.context)
            if(existingSpec) {
              existingSpec.actions = existingSpec.actions.concat(actionGroupSpec.actions)
            } else {actionGroupSpec
              actionGroupsMap.set(actionGroupSpec.context, actionGroupSpec)
            }
          } else {
            console.log("Invalid ActionGroupSpec: " + JSON.stringify(actionGroupSpec))
          }
        })
        if(this.onLoad) {
          const actionGroups : ActionGroupSpecs = Array.from(actionGroupsMap.values())
          actionGroups.sort((i1,i2) => (i1.order || 100) - (i2.order || 100))
          this.onLoad(actionGroups)
        }
      }
    })
  }

  static configureActions(actionGroupSpec: ActionGroupSpec) {
    switch(actionGroupSpec.context) {
      case ActionCategory.Cluster:
        this.configureClusterActions(actionGroupSpec)
        break
      case ActionCategory.Namespace:
        this.configureNamespaceActions(actionGroupSpec)
        break
    }
  }

  static addReloadAction(actionGroupsMap : Map<string, ActionGroupSpec>) {
    const reloadAction = {
      order: 1,
      context: "Common",
      actions: [
        {
          name: "Reload Actions",
          execute() {
            ActionLoader.loadActionPlugins()
          },
          render() {
            return [["Actions Reloaded"]]
          }
        },
      ]
    }
    actionGroupsMap.set(reloadAction.context, reloadAction)
  }

  static configureClusterActions(actionGroupSpec: ActionGroupSpec) {
    const getClusters : methodGetClusters = () => this.context ? this.context.clusters() : []
    const getK8sClients : methodGetK8sClients = () => {
      return this.context.clusters().map(k8s.getClientForCluster)
    }

    actionGroupSpec.actions.forEach(action => {
      if(!isClusterActionSpec(action)) {
        console.log("Not ClusterActionSpec: " + JSON.stringify(action))
      } else {
        action.act = action.act.bind(null, getClusters, getK8sClients, this.onOutput)
      }
    })
  }

  static configureNamespaceActions(actionGroupSpec: ActionGroupSpec) {
    const getClusters : methodGetClusters = () => this.context ? this.context.clusters() : []
    const getK8sClients : methodGetK8sClients = () => {
      return this.context.clusters().map(k8s.getClientForCluster)
    }
    const getNamespaces = () => this.context ? this.context.allNamespaces() : []

    actionGroupSpec.actions.forEach(action => {
      if(!isNamespaceActionSpec(action)) {
        console.log("Not NamespaceActionSpec: " + JSON.stringify(action))
      } else {
        action.act = action.act.bind(null, getClusters, getK8sClients, getNamespaces, this.onOutput)
      }
    })
  }
}