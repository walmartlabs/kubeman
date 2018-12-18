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