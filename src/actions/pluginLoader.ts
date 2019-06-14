/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'

export default class PluginLoader {

  static loadPlugins() {
    const plugins : any[] = []
    const pluginRequire = require.context("../plugins" , true, /\.(ts|js)$/)
    const keys = pluginRequire.keys()
    for(const i in keys) {
      let tsPlugin = keys[i]
      delete __webpack_require__.c[pluginRequire.resolve(tsPlugin)]
      tsPlugin = tsPlugin.replace("./", "")
      let plugin = require("../plugins/" + tsPlugin)
      if(plugin.default && plugin.default.actions) {
        plugin = plugin.default
      }
      plugins.push(_.cloneDeep(plugin))
    }
    return plugins
  }
}