import PluginLoader from './pluginLoader'
import {ActionContextType, ActionGroupSpec, ActionGroupSpecs, ActionContextOrder,
        isActionGroupSpec, isActionSpec, ActionOutput, ActionOutputStyle, 
        ActionOutputCollector, ActionStreamOutputCollector, ActionChoiceMaker, BoundActionAct, ActionOnInfo, } from './actionSpec'
import Context from "../context/contextStore";
import ActionContext from './actionContext'

export class ActionLoader {
  static onLoad: (ActionGroupSpecs) => void
  static onOutput: (action, output, style) => void
  static onStreamOutput: (action, output) => void
  static onActionInitChoices: ActionChoiceMaker
  static onActionChoices: ActionChoiceMaker
  static onShowInfo: ActionOnInfo
  static onSetScrollMode: (boolean) => void
  static onOutputLoading: (boolean) => void
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

  static setOnActionChoices(onActionInitChoices: ActionChoiceMaker, onActionChoices: ActionChoiceMaker) {
    this.onActionInitChoices = onActionInitChoices
    this.onActionChoices = onActionChoices
  }

  static setOnShowInfo(callback: ActionOnInfo) {
    this.onShowInfo = callback
  }

  static setOnSetScrollMode(callback: (boolean) => void) {
    this.onSetScrollMode = callback
  }

  static setOnOutputLoading(callback: (boolean) => void) {
    this.onOutputLoading = callback
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
            if(actionGroupSpec.order) {
              existingSpec.order = actionGroupSpec.order
            }
            existingSpec.actions = existingSpec.actions.concat(actionGroupSpec.actions)
          } else {
            if(!actionGroupSpec.order) {
              actionGroupSpec.order = ActionContextOrder[actionGroupSpec.context || ActionContextType.Other]
              const existingGroupOrders = Array.from(actionGroupsMap.values())
                                            .filter(group => (group.title || group.context) === (actionGroupSpec.title || actionGroupSpec.context))
                                            .map(group => group.order)
                                            .sort((o1,o2) => (o2||100)-(o1||100))
              if(actionGroupSpec.title && existingGroupOrders.length > 0) {
                actionGroupSpec.order = (existingGroupOrders[0]||actionGroupSpec.order||0)+1 
              }
            }
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
      actionGroups.sort((i1,i2) => (i1.order !== i2.order) ? (i1.order || 100) - (i2.order || 100)
                                      : (i1.title||"").localeCompare(i2.title||"") )
      actionGroups.forEach(group => group.actions.sort((i1,i2) => (i1.order || 100) - (i2.order || 100)))
      this.onLoad(actionGroups)
    }
  }

  static configureActions(actionGroupSpec: ActionGroupSpec) {
    actionGroupSpec.title = actionGroupSpec.title || (actionGroupSpec.context + " Recipes")
    this.bindActions(actionGroupSpec)
  }

  static bindActions(actionGroupSpec: ActionGroupSpec) {
    actionGroupSpec.actions.forEach(action => {
      action.context = actionGroupSpec.context
      if(!isActionSpec(action)) {
        console.log("Not ActionSpec: " + JSON.stringify(action))
      } else {
        action.chooseAndAct = () => {
          action.stopped = false
          if(this.checkSelections({
            checkClusters: true,
            checkNamespaces: false
          })) {
            action.onOutput = this.onOutput.bind(this, action)
            action.onStreamOutput = this.onStreamOutput.bind(this, action)
            action.setScrollMode = this.onSetScrollMode
            action.showOutputLoading = this.onOutputLoading
            action.showInfo = this.onShowInfo
            if(action.choose) {
              this.actionContext.onActionInitChoices = this.onActionInitChoices.bind(this, action.act.bind(action, this.actionContext))
              this.actionContext.onSkipChoices = action.act.bind(action, this.actionContext)
              action.choose(this.actionContext)
            } else {
              action.act(this.actionContext)
            }
          }
        }
        const actionRefresh = action.refresh
        action.autoRefreshDelay = action.autoRefreshDelay || 60
        actionRefresh && (action.refresh = () => {
          actionRefresh && actionRefresh.call(action, this.actionContext)
        })
        const stop = action.stop ? action.stop.bind(action, this.actionContext) : undefined
        action.stop = () => {
          action.stopped = true
          stop && stop()
        }
        if(action.react || action.clear) {
          const actionReact = action.react && action.react.bind(action)
          const commands: string[] = [
            "/c(lear): clears output",
            "/h(elp): shows help"
          ]
          action.refresh && commands.push("/r(efresh): refresh output now")
          const boundReact = action.react = () => {
            switch(this.actionContext.inputText) {
              case "help":
              case "h":
                this.onShowInfo('Command Help', commands)
                break
              case "clear":
              case "c":
                action.clear && action.clear(this.actionContext)
                break
              case "refresh":
              case "r":
                actionRefresh && actionRefresh.call(action, this.actionContext)
                break
              default:
                actionReact && actionReact(this.actionContext)
                break
            }
          }
          action.showChoices = this.onActionChoices.bind(this, boundReact)
        }
      }
    })
  }

  static checkSelections({checkClusters, checkNamespaces}: 
                          {checkClusters?: boolean, checkNamespaces?: boolean}) {
    let result = true
    if(checkClusters && this.context.clusters.length === 0) {
      result = false
      this.onOutput && this.onOutput(undefined, [["No clusters selected"]], ActionOutputStyle.Text)
    } else if(checkNamespaces && this.context.namespaces.length === 0) {
      result = false
      this.onOutput && this.onOutput(undefined, [["No namespaces selected"]], ActionOutputStyle.Text)
    }
    return result
  }
}