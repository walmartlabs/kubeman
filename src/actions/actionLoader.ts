import fs from 'fs'
import path from 'path'
import * as ts from "typescript";

import {ActionContext, ActionGroupSpec, ActionGroupSpecs, isActionGroupSpec, 
        methodGetClusters, methodGetK8sClients, 
        isClusterActionSpec, isNamespaceActionSpec, isPodActionSpec,
        ActionOutput, ActionOutputStyle, } from './actionSpec'
import Context from "../context/contextStore";
import {Cluster, Namespace, Pod, Item} from "../k8s/contextObjectTypes";
import * as k8s from '../k8s/k8sClient'
import actions from './actions';


const actionPluginFolder = "plugins"

export class ActionLoader {

  static onLoad: (ActionGroupSpecs) => void
  static onOutput: (ActionOutput, ActionOutputStyle?) => void
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
          actionGroups.forEach(group => group.actions.sort((i1,i2) => (i1.order || 100) - (i2.order || 100)))
          this.onLoad(actionGroups)
        }
      }
    })
  }

  static loadTSPlugins() {
  /*    
    const tsModulePath = path.join(__dirname, "tsPlugins")
    fs.readdir(tsModulePath, (err, files) => {
      console.log(files)
      files.forEach(filename => {
        const filePath =  path.join(path.resolve(__dirname), "tsPlugins", filename)
        fs.readFile(filePath, "utf8", (err, data) => {
          let result = ts.transpileModule(data, {
            compilerOptions: { 
              module: ts.ModuleKind.ESNext ,
              sourceMap: true,
              target: ts.ScriptTarget.ESNext,
              allowSyntheticDefaultImports: true,
              allowJs: true,
              jsx: ts.JsxEmit.React,
              moduleResolution: ts.ModuleResolutionKind.NodeJs,
            }
          });
          console.log(result.outputText + "")
          const actionSpec = eval(result.outputText)
          console.log(actionSpec)
        })
      })
    })
  */  
  }

  static configureActions(actionGroupSpec: ActionGroupSpec) {
    switch(actionGroupSpec.context) {
      case ActionContext.Common:
        this.configureCommonActions(actionGroupSpec)
        break
      case ActionContext.Cluster:
        this.configureClusterActions(actionGroupSpec)
        break
      case ActionContext.Namespace:
        this.configureNamespaceActions(actionGroupSpec)
        break
      case ActionContext.Pod:
        this.configurePodActions(actionGroupSpec)
        break
    }
  }

  static addReloadAction(actionGroupsMap : Map<string, ActionGroupSpec>) {
    const reloadAction = {
      order: 1,
      context: ActionContext.Common,
      actions: [
        {
          name: "Reload Actions",
          act: function(onOutput) {
            ActionLoader.loadActionPlugins()
            onOutput([["Actions Reloaded"]])
          }.bind(null, this.onOutput)
        }
      ]
    }
    actionGroupsMap.set(reloadAction.context, reloadAction)
  }

  static configureCommonActions(actionGroupSpec: ActionGroupSpec) {
    actionGroupSpec.actions.forEach(action => {
      if(action.act) {
        action.act = action.act.bind(null, this.onOutput)
      }
    })
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
    const getNamespaces = () => this.context ? this.context.namespaces() : []

    actionGroupSpec.actions.forEach(action => {
      if(!isNamespaceActionSpec(action)) {
        console.log("Not NamespaceActionSpec: " + JSON.stringify(action))
      } else {
        action.act = action.act.bind(null, getClusters, getNamespaces, getK8sClients, this.onOutput)
      }
    })
  }

  static configurePodActions(actionGroupSpec: ActionGroupSpec) {
    const getPods = async () => {
      const k8sClients = this.context.clusters().map(k8s.getClientForCluster)
      const pods : {} = {}
      const clusters = this.context.clusters()
      for(const i in clusters) {
        const cluster = clusters[i]
        pods[cluster.name] = {}
        const namespaces = this.context.namespacesForCluster(cluster)
        for(const j in namespaces) {
          const namespace = namespaces[j]
          pods[cluster.name][namespace.name] = []
          const nsPods = this.context.podsForNamespace(namespace)
          for(const k in nsPods) {
            const nsPod = nsPods[k]
            const pod = await k8sClients[i].namespace(namespace.name).pods(nsPod.name).get()
            pod && pods[cluster.name][namespace.name].push(pod.body)
          }
        }
      }
      return pods
    }

    actionGroupSpec.actions.forEach(action => {
      if(!isPodActionSpec(action)) {
        console.log("Not PodActionSpec: " + JSON.stringify(action))
      } else {
        action.act = action.act.bind(null, getPods, this.onOutput)
      }
    })
  }
}