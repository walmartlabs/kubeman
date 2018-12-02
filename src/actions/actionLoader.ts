import fs from 'fs'
import path from 'path'

import {ActionCategory, ActionGroupSpec, ActionGroupSpecs, isActionsSpec, 
        methodGetClusters, methodGetK8sClients, isClusterActionSpec,
        ActionOutput, ActionOutputStyle, } from './actionSpec'
import Context from "../context/contextStore";
import * as k8s from '../k8s/k8sClient'
import actions from './actions';


const actionPluginFolder = "plugins"

export class ActionLoader {

  static onLoad: (ActionsSpecs) => void
  static onOutput: (ActionOutput, ActionOutputStyle) => void
  static context: Context

  static setContext(context: Context) {
    this.context = context
  }

  static setOnLoad(callback: (ActionsSpecs) => void) {
    this.onLoad = callback
  }

  static setOnOutput(callback: (ActionOutput, ActionOutputStyle) => void) {
    this.onOutput = callback
  }

  static loadActionPlugins() {
    let actionsSpecs : ActionGroupSpecs = []
    const modulePath = path.join(__dirname, actionPluginFolder)

    fs.readdir(modulePath, (err, files) => {
      if(err && err.code) {
        console.log("Failed to load plugins: " + err)
      } else {
        files.forEach(filename => {
          const filePath =  path.join(path.resolve(__dirname), actionPluginFolder, filename)
          const globalRequire = global['require']
          delete globalRequire.cache[globalRequire.resolve(filePath)]
          const actionsSpec = globalRequire(filePath)
          if(isActionsSpec(actionsSpec)) {
            ActionLoader.configureActions(actionsSpec)
            actionsSpecs.push(actionsSpec)
          } else {
            console.log("Invalid ActionSpec: " + JSON.stringify(actionsSpec))
          }
        })
        if(this.onLoad) {
          actionsSpecs.sort((i1,i2) => (i1.order || 100) - (i2.order || 100))
          this.onLoad(actionsSpecs)
        }
      }
    })
  }

  static configureActions(actionsSpec: ActionGroupSpec) {
    switch(actionsSpec.context) {
      case ActionCategory.Common:
        this.configureCommonActions(actionsSpec)
        break
      case ActionCategory.Cluster:
        this.configureClusterActions(actionsSpec)
        break
      case ActionCategory.Namespace:
        this.configureNamespaceActions(actionsSpec)
        break
    }
  }

  static configureCommonActions(actionsSpec: ActionGroupSpec) {
    actionsSpec.actions.unshift({
      name: "Reload Actions",
      execute() {
        ActionLoader.loadActionPlugins()
      },
      render() {
        return [["Actions Reloaded"]]
      }
    })
  }

  static configureClusterActions(actionsSpec: ActionGroupSpec) {
    const getClusters : methodGetClusters = () => this.context ? this.context.clusterNames() : []
    const getK8sClients : methodGetK8sClients = () => {
      return this.context.clusters().map(k8s.getClientForCluster)
    }

    actionsSpec.actions.forEach(action => {
      if(!isClusterActionSpec(action)) {
        console.log("Not ClusterActionSpec: " + action)
      } else {
        action.act = action.act.bind(null, getClusters, getK8sClients, this.onOutput)
      }
    })
  }

  static configureNamespaceActions(actionsSpec: ActionGroupSpec) {
    actionsSpec.actions.forEach(action => {
      if(action.act) {
        action.act = action.act.bind(null, this.context)
      }
    })
  }
}