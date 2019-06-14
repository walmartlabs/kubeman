/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

module.exports = {
  devtool: 'inline-source-map',
  mode: "development",
  output: {
    devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    chunkFilename: '[name].bundle.js',
    pathinfo: true,
  },
  optimization: {
    namedModules: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"]
  },
  module: {
    rules: [
      { test: /\.css$/, loader: "style-loader!css-loader?importLoaders=1" }
    ]
  },
}