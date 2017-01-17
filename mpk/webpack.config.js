'use strict';

var path = require('path');
var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './app/app.js',
    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: 'babel-loader',
                exclude: /node_modules/,
                query: {
                    presets: ['es2015']
                }
            },
            {
                test: /.scss$/,
                loaders: ['style', 'css', 'sass'],
                include: path.resolve(__dirname, '../')
            },
            {
                test: /\.png$/,
                loader: 'url-loader', //options: { limit: 100000 } },
                query: {
                    limit: 100000
                }
            },
            {
                test: /\.jpg$/,
                loader: 'file-loader'
            }
        ]
    },

    output: {
        filename: 'dist/bundle.js'
    },

    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoErrorsPlugin(),
        new HtmlWebpackPlugin({
            template: 'app/index.html',
            inject: true
        })
    ],
    devtool: 'eval-source-map'
};