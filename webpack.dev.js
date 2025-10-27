const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './src',
    host: '0.0.0.0',
    port: 9000
  }
  // optimization: {
  //   minimize: false // can't minimize 4 now see: https://scotch.io/tutorials/declaring-angularjs-modules-for-minification
  // }
});
