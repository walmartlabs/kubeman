module.exports = {
  devtool: 'inline-source-map',
  output: {
    devtoolModuleFilenameTemplate: '[absolute-resource-path]'
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"]
  },
  module: {
    rules: [
      { test: /\.css$/, loader: "style-loader!css-loader?importLoaders=1" },
    ]
  }
}