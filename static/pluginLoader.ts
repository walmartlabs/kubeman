import _ from 'lodash'

export default class PluginLoader {

  static loadPlugins() : any[] {
    const plugins : any[] = []
    const tsPluginRequire = require.context("./plugins" , true, /\.(ts|js)$/)
    tsPluginRequire.keys().forEach(tsPlugin => {
      delete require.cache[tsPluginRequire.resolve(tsPlugin)]
      let plugin = tsPluginRequire(tsPlugin)
      if(plugin.default && plugin.default.actions) {
        plugin = plugin.default
      }
      plugins.push(_.cloneDeep(plugin))
    })
    return plugins
  }
}