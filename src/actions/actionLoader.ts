import fs from 'fs'
import path from 'path'
import * as ts from "typescript";

import {ActionContextType, ActionGroupSpec, ActionGroupSpecs, ActionContextOrder,
        isActionGroupSpec, isActionSpec, ActionOutput, ActionOutputStyle, 
        ActionOutputCollector, ActionChoiceMaker, } from './actionSpec'
import Context from "../context/contextStore";
import ActionContext from './actionContext'
import * as k8s from '../k8s/k8sClient'
import actions from './actions';


const actionPluginFolder = "plugins"

export class ActionLoader {
  static onLoad: (ActionGroupSpecs) => void
  static onOutput: ActionOutputCollector
  static onChoices: ActionChoiceMaker
  static context: Context
  static actionContext: ActionContext = new ActionContext

  static setContext(context: Context) {
    this.context = context
    this.actionContext.context = context
  }

  static setOnLoad(callback: (ActionGroupSpecs) => void) {
    this.onLoad = callback
  }

  static setOnOutput(callback: ActionOutputCollector) {
    this.onOutput = callback
    this.actionContext.onOutput = callback
  }

  static setOnChoices(callback: ActionChoiceMaker) {
    this.onChoices = callback
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
            if(actionGroupSpec.title) {
              const existingSpec = actionGroupsMap.get(actionGroupSpec.title)
              if(existingSpec) {
                existingSpec.actions = existingSpec.actions.concat(actionGroupSpec.actions)
              } else {actionGroupSpec
                actionGroupsMap.set(actionGroupSpec.title, actionGroupSpec)
              }
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
    actionGroupSpec.order = ActionContextOrder[actionGroupSpec.context || ActionContextType.Other]
    if(actionGroupSpec.title) {
      actionGroupSpec.order++
    }
    actionGroupSpec.title = actionGroupSpec.title || (actionGroupSpec.context + " Actions")
    actionGroupSpec.actions.sort((i1,i2) => (i1.order || 100) - (i2.order || 100))

    switch(actionGroupSpec.context) {
      case ActionContextType.Common:
        this.configureCommonActions(actionGroupSpec)
        break
      case ActionContextType.Cluster:
      case ActionContextType.Namespace:
      case ActionContextType.Pod:
        this.bindActions(actionGroupSpec)
        break
    }
  }

  static addReloadAction(actionGroupsMap : Map<string, ActionGroupSpec>) {
    const reloadAction = {
      order: 1,
      title: "Common Actions",
      context: ActionContextType.Common,
      actions: [
        {
          name: "Reload Actions",
          context: ActionContextType.Common,
          act: function(onOutput: ActionOutputCollector) {
            ActionLoader.loadActionPlugins()
            onOutput([["Actions Reloaded"]], ActionOutputStyle.Text)
          }.bind(null, this.onOutput)
        }
      ]
    }
    actionGroupsMap.set(reloadAction.title, reloadAction)
  }

  static configureCommonActions(actionGroupSpec: ActionGroupSpec) {
    actionGroupSpec.actions.forEach(action => {
      action.context = actionGroupSpec.context
      if(action.act) {
        action.act = action.act.bind(action, this.onOutput)
      }
    })
  }

  static bindActions(actionGroupSpec: ActionGroupSpec) {
    actionGroupSpec.actions.forEach(action => {
      action.context = actionGroupSpec.context
      if(!isActionSpec(action)) {
        console.log("Not ActionSpec: " + JSON.stringify(action))
      } else {
        const act = action.act
        action.act = () => {
          if(this.checkSelections({
            checkClusters: true, 
            checkNamespaces: actionGroupSpec.context === ActionContextType.Namespace
                            || actionGroupSpec.context === ActionContextType.Pod,
            checkPods: actionGroupSpec.context === ActionContextType.Pod,
          })) {
            if(action.choose) {
              this.actionContext.onChoices = this.onChoices.bind(this, 
                  act.bind(action, this.actionContext))
              action.choose(this.actionContext)
            } else {
              act.call(action, this.actionContext)
            }
          }
        }
      }
    })
  }

  static checkSelections({checkClusters, checkNamespaces, checkPods}: 
                          {checkClusters?: boolean, checkNamespaces?: boolean, checkPods?: boolean}) {
    let result = true
    if(checkClusters && this.context.clusters().length === 0) {
      result = false
      this.onOutput([["No clusters selected"]], ActionOutputStyle.Text)
    } else if(checkNamespaces && this.context.namespaces().length === 0) {
      result = false
      this.onOutput([["No namespaces selected"]], ActionOutputStyle.Text)
    } else if(checkPods && this.context.pods().length === 0) {
      result = false
      this.onOutput([["No pods selected"]], ActionOutputStyle.Text)
    }
    return result
  }
}