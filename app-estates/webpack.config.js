"use strict";

var webpack = require('webpack');
var path = require('path');
var loaders = require('./webpack.loaders');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var DashboardPlugin = require('webpack-dashboard/plugin');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 8080;

// global css
loaders.push({
    test: /\.css$/,
    exclude: /[\/\\]src[\/\\]/,
    loaders: [
        'style?sourceMap',
        'css'
    ]
});
// local scss modules
loaders.push({
    test: /\.scss$/,
    exclude: /[\/\\](node_modules|bower_components|public\/)[\/\\]/,
    loaders: [
        'style?sourceMap',
        'css?modules&importLoaders=1&localIdentName=[path]___[name]__[local]___[hash:base64:5]&sourceMap',
        'postcss',
        'sass'
    ]
});

// local css modules
loaders.push({
    test: /\.css$/,
    exclude: /[\/\\](node_modules|bower_components|public\/)[\/\\]/,
    loaders: [
        'style?sourceMap',
        'css?modules&importLoaders=1&localIdentName=[path]___[name]__[local]___[hash:base64:5]&sourceMap'
    ]
});

module.exports = {
    entry: [
        'react-hot-loader/patch',
        './src/index.jsx'
    ],
    devtool: process.env.WEBPACK_DEVTOOL || 'eval-source-map',
    output: {
        publicPath: '/',
        path: path.join(__dirname, 'public'),
        filename: 'bundle.js'
    },
    resolve: {
        extensions: ['', '.js', '.jsx']
    },
    module: {
        loaders
    },
    devServer: {
        contentBase: './public',
        noInfo: true,
        // enable HMR
        hot: true,
        inline: true,
        historyApiFallback: true,
        port: PORT,
        host: HOST
    },
    plugins: [
        new webpack.NoErrorsPlugin(),
        new webpack.HotModuleReplacementPlugin(),
        new DashboardPlugin(),
        new HtmlWebpackPlugin({
            template: './src/template.html'
        }),
    ]
};