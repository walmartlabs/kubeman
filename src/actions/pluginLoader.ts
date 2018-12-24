import _ from 'lodash'

export default class PluginLoader {

  static loadPlugins() {
    const plugins : any[] = []
    const pluginRequire = require.context("../plugins" , true, /\.(ts|js)$/)
    const keys = pluginRequire.keys()
    for(const i in keys) {
      let tsPlugin = keys[i]
      delete __webpack_require__.c[pluginRequire.resolve(tsPlugin)]
      const pieces = tsPlugin.split("/")
      tsPlugin = pieces[pieces.length-1]
      let plugin = require("../plugins/" + tsPlugin)
      if(plugin.default && plugin.default.actions) {
        plugin = plugin.default
      }
      plugins.push(_.cloneDeep(plugin))
    }
    return plugins
  }
}