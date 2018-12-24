import PluginLoader from '../../static/pluginLoader'
import {ActionContextType, ActionGroupSpec, ActionGroupSpecs, ActionContextOrder,
        isActionGroupSpec, isActionSpec, ActionOutput, ActionOutputStyle, 
        ActionOutputCollector, ActionStreamOutputCollector, ActionChoiceMaker, BoundActionAct, } from './actionSpec'
import Context from "../context/contextStore";
import ActionContext from './actionContext'

export class ActionLoader {
  static onLoad: (ActionGroupSpecs) => void
  static onOutput: ActionOutputCollector
  static onStreamOutput: ActionOutputCollector
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

  static setOnOutput(onOutput: ActionOutputCollector, onStreamOutput: ActionStreamOutputCollector) {
    this.onOutput = onOutput
    this.onStreamOutput = onStreamOutput
    this.actionContext.onOutput = onOutput
    this.actionContext.onStreamOutput = onStreamOutput
  }

  static setOnChoices(callback: ActionChoiceMaker) {
    this.onChoices = callback
  }
 
  static async loadActionPlugins() {
    const plugins = await PluginLoader.loadPlugins()
    let actionGroupsMap : Map<string, ActionGroupSpec> = new Map
    this.addReloadAction(actionGroupsMap)

    plugins.forEach(actionGroupSpec => {
      if(isActionGroupSpec(actionGroupSpec)) {
        ActionLoader.configureActions(actionGroupSpec)
        if(actionGroupSpec.title) {
          const existingSpec = actionGroupsMap.get(actionGroupSpec.title)
          if(existingSpec) {
            existingSpec.actions = existingSpec.actions.concat(actionGroupSpec.actions)
          } else {actionGroupSpec
            actionGroupsMap.set(actionGroupSpec.title, actionGroupSpec)
          }
        } else {
          console.log("Title missing for action plugin [%s]", JSON.stringify(actionGroupSpec))
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

  static configureActions(actionGroupSpec: ActionGroupSpec) {
    actionGroupSpec.order = ActionContextOrder[actionGroupSpec.context || ActionContextType.Other]
    if(actionGroupSpec.title) {
      actionGroupSpec.order && actionGroupSpec.order++
    }
    actionGroupSpec.title = actionGroupSpec.title || (actionGroupSpec.context + " Actions")

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
        action.act = action.act.bind(action, this.actionContext)
      }
    })
  }

  static bindActions(actionGroupSpec: ActionGroupSpec) {
    actionGroupSpec.actions.forEach(action => {
      action.context = actionGroupSpec.context
      if(!isActionSpec(action)) {
        console.log("Not ActionSpec: " + JSON.stringify(action))
      } else {
        const act: BoundActionAct = action.act.bind(action, this.actionContext)
        action.act = () => {
          if(this.checkSelections({
            checkClusters: true, 
            checkNamespaces: actionGroupSpec.context === ActionContextType.Namespace
                            || actionGroupSpec.context === ActionContextType.Pod,
            checkPods: actionGroupSpec.context === ActionContextType.Pod,
          })) {
            if(action.choose) {
              this.actionContext.onChoices = this.onChoices.bind(this, act)
              this.actionContext.onSkipChoices = act
              action.choose(this.actionContext)
            } else {
              act()
            }
          }
        }
        action.react && (action.react = action.react.bind(action, this.actionContext))
        action.stop && (action.stop = action.stop.bind(action, this.actionContext))
      }
    })
  }

  static checkSelections({checkClusters, checkNamespaces, checkPods}: 
                          {checkClusters?: boolean, checkNamespaces?: boolean, checkPods?: boolean}) {
    let result = true
    if(checkClusters && this.context.clusters.length === 0) {
      result = false
      this.onOutput([["No clusters selected"]], ActionOutputStyle.Text)
    } else if(checkNamespaces && this.context.namespaces.length === 0) {
      result = false
      this.onOutput([["No namespaces selected"]], ActionOutputStyle.Text)
    } else if(checkPods && this.context.pods.length === 0) {
      result = false
      this.onOutput([["No pods selected"]], ActionOutputStyle.Text)
    }
    return result
  }
}