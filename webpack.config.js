/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const BrowserSyncPlugin = require('browser-sync-webpack-plugin');
const MergeIntoSingleFilePlugin = require('webpack-merge-and-include-globally');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const UglifyJs = require('uglify-js');
const path = require('path');
const staticBundles = require('./media/static-bundles.json');
const webpack = require('webpack');

const uglifyOptions = {
    ie8: true
};

function resolveBundles(fileList){
    return fileList.map((f) => {
        if (f.match(/^protocol\//)) {
            return `./node_modules/@mozilla-protocol/core/${f}`;
        }
        return path.resolve(__dirname, 'media', f);
    });
}

function compressJs(code) {
    if (process.env.NODE_ENV === 'production') {
        const min = UglifyJs.minify(code, uglifyOptions);
        return min.code;
    }
    return code;
}

function getBundleNames(bundleType) {
    return staticBundles[bundleType].map(bundle => {
        return `${bundle['name']}--${bundleType}`;
    });
}

function getAllbundles() {
    return new Promise((resolve) => {
        const allFiles = {};
        staticBundles['css'].forEach(bundle => {
            const name = `${bundle['name']}--scss`;
            const files = resolveBundles(bundle['files']);
            allFiles[name] = files;
        });
        staticBundles['js'].forEach(bundle => {
            const name = `${bundle['name']}--js`;
            const files = resolveBundles(bundle['files']);
            allFiles[name] = files;
        });
        resolve(allFiles);
    });
}

// Keep a reference to watched JS files for MergeIntoSingleFilePlugin
const jsBundleNames = getBundleNames('js');

module.exports = {
    mode: process.env.NODE_ENV,
    entry: () => getAllbundles(),
    output: {
        filename: 'temp/[name].js',
        path: path.resolve(__dirname, 'assets/'),
        publicPath: '/media/',
    },
    optimization: {
        minimizer: [new OptimizeCSSAssetsPlugin({})],
    },
    module: {
        rules: [
            {
                test: /\.scss$/,
                include: path.resolve(__dirname, 'media'),
                use: [
                    MiniCssExtractPlugin.loader,
                    'cache-loader',
                    'css-loader',
                    'sass-loader',
                ],
            },
        ],
    },
    watchOptions: {
        aggregateTimeout: 600,
        ignored: './node_modules/'
    },
    performance: {
        hints: 'warning'
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
        }),
        new MiniCssExtractPlugin({
            moduleFilename: ({ name }) => `css/${name.replace('--scss', '')}.css`,
        }),
        // JS bundles use global scope instead of require() for older browser compatibility.
        new MergeIntoSingleFilePlugin({
            files: staticBundles['js'].map((bundle) => {
                return {
                    src: resolveBundles(bundle['files']),
                    dest: code => {
                        const name = `js/${bundle['name']}.js`;
                        const _code = compressJs(code);
                        const obj = {};
                        obj[name] = _code;
                        return obj;
                    }
                };
            }),
            chunks: jsBundleNames
        }),
        new BrowserSyncPlugin({
            port: 8000,
            proxy: process.env.BS_PROXY_URL || 'localhost:8080',
            open: !(process.env.BS_OPEN_BROWSER === 'false'),
            notify: true,
            reloadDelay: 500,
            reloadDebounce: 500,
            ui: {
                port: 8001
            },
            serveStatic: [{
                route: '/media',
                dir: '/assets'
            }]
        })
    ]
};
