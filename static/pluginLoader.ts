import fs from 'fs'
import path from 'path'
import _ from 'lodash'
const isDevelopment = process.env.NODE_ENV !== 'production'

export default class PluginLoader {

  static async getDevPlugin(plugin) {
    return await import("../src/plugins/" + plugin)
  }

  static async getProdPlugin(plugin) {
    return await import("./plugins/" + plugin)
  }

  static getDevPluginContext() {
    return require.context("../src/plugins" , true, /\.(ts|js)$/)
  }

  static getProdPluginContext() {
    return require.context("./plugins" , true, /\.(ts|js)$/)
  }

  static async loadPlugins() {
    const plugins : any[] = []
    const tsPluginRequire = isDevelopment ? this.getDevPluginContext() : this.getProdPluginContext()
    const keys = tsPluginRequire.keys()
    for(const i in keys) {
      let tsPlugin = keys[i]
      delete __webpack_require__.c[tsPluginRequire.resolve(tsPlugin)]
      const pieces = tsPlugin.split("/")
      tsPlugin = pieces[pieces.length-1]
      let plugin = await (isDevelopment ? this.getDevPlugin(tsPlugin) : this.getProdPlugin(tsPlugin))
      if(plugin.default && plugin.default.actions) {
        plugin = plugin.default
      }
      plugins.push(_.cloneDeep(plugin))
    }
    return plugins
  }
}