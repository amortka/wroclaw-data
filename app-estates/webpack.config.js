"use strict";

var webpack = require('webpack');
var path = require('path');
var loaders = require('./webpack.loaders');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var DashboardPlugin = require('webpack-dashboard/plugin');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 8080;

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
        /*preloaders: [
            { test: /\.jsx?$/, loader: 'eslint', exclude: /node_modules/ }
        ],*/
        loaders
    },
    devServer: {
        contentBase: './public',
        // noInfo: true,
        // enable HMR
        hot: true,
        inline: true,
        historyApiFallback: true,
        port: PORT,
        host: HOST
    },
    plugins: [
        // new webpack.NoErrorsPlugin(),
        new webpack.HotModuleReplacementPlugin(),
        // new DashboardPlugin(),
        new HtmlWebpackPlugin({
            template: './src/template.html'
        }),
    ]
};
