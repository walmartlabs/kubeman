import PluginLoader from './pluginLoader'
import {ActionContextType, ActionGroupSpec, ActionGroupSpecs, ActionContextOrder,
        isActionGroupSpec, isActionSpec, ActionOutput, ActionOutputStyle, 
        ActionOutputCollector, ActionStreamOutputCollector, ActionChoiceMaker, BoundActionAct, } from './actionSpec'
import Context from "../context/contextStore";
import ActionContext from './actionContext'

export class ActionLoader {
  static onLoad: (ActionGroupSpecs) => void
  static onOutput: (action, output, style) => void
  static onStreamOutput: (action, output) => void
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
    this.onOutput = (action, output, style) => {
      if(!action || !action.stopped) onOutput(output, style)
    }
    this.onStreamOutput = (action, output) => {
      if(!action || !action.stopped) onStreamOutput(output)
    }
  }

  static setOnChoices(callback: ActionChoiceMaker) {
    this.onChoices = callback
  }
 
  static loadActionPlugins() {
    const plugins = PluginLoader.loadPlugins()
    let actionGroupsMap : Map<string, ActionGroupSpec> = new Map

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
    if(!actionGroupSpec.order) {
      actionGroupSpec.order = ActionContextOrder[actionGroupSpec.context || ActionContextType.Other]
    }
    if(actionGroupSpec.title) {
      actionGroupSpec.order && actionGroupSpec.order++
    }
    actionGroupSpec.title = actionGroupSpec.title || (actionGroupSpec.context + " Recipes")

    switch(actionGroupSpec.context) {
      case ActionContextType.Common:
        this.configureCommonActions(actionGroupSpec)
        break
      default:
        this.bindActions(actionGroupSpec)
        break
    }
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
        const originalAct = action.act
        action.act = () => {
          action.stopped = false
          if(this.checkSelections({
            checkClusters: true,
            checkNamespaces: actionGroupSpec.context === ActionContextType.Namespace
                            || actionGroupSpec.context === ActionContextType.Pod,
            checkPods: actionGroupSpec.context === ActionContextType.Pod,
          })) {
            action.onOutput = this.onOutput.bind(this, action)
            action.onStreamOutput =this.onStreamOutput.bind(this, action)

            if(action.choose) {
              this.actionContext.onChoices = this.onChoices.bind(this, originalAct.bind(action, this.actionContext))
              this.actionContext.onSkipChoices = originalAct.bind(action, this.actionContext)
              action.choose(this.actionContext)
            } else {
              originalAct.call(action, this.actionContext)
            }
          }
        }
        action.react && (action.react = action.react.bind(action, this.actionContext))
        const stop = action.stop ? action.stop.bind(action, this.actionContext) : undefined
        action.stop = () => {
          action.stopped = true
          stop && stop()
        }
      }
    })
  }

  static checkSelections({checkClusters, checkNamespaces, checkPods}: 
                          {checkClusters?: boolean, checkNamespaces?: boolean, checkPods?: boolean}) {
    let result = true
    if(checkClusters && this.context.clusters.length === 0) {
      result = false
      this.onOutput && this.onOutput(undefined, [["No clusters selected"]], ActionOutputStyle.Text)
    } else if(checkNamespaces && this.context.namespaces.length === 0) {
      result = false
      this.onOutput && this.onOutput(undefined, [["No namespaces selected"]], ActionOutputStyle.Text)
    } else if(checkPods && this.context.pods.length === 0) {
      result = false
      this.onOutput && this.onOutput(undefined, [["No pods selected"]], ActionOutputStyle.Text)
    }
    return result
  }
}