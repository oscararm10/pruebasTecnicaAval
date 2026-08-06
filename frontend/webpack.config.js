const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

const deps = require('./package.json').dependencies;

/**
 * Micro-frontends con Webpack Module Federation:
 * - shell: host / orquestador de rutas
 * - expone SolicitanteApp y AprobadorApp como remotes consumibles
 */
/** @type {import('webpack').Configuration} */
module.exports = {
  entry: './src/shell/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    publicPath: 'auto',
    clean: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: { transpileOnly: true },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'avalShell',
      filename: 'remoteEntry.js',
      exposes: {
        './SolicitanteApp': './src/solicitante/SolicitanteApp',
        './AprobadorApp': './src/aprobador/AprobadorApp',
      },
      shared: {
        react: { singleton: true, requiredVersion: deps.react },
        'react-dom': { singleton: true, requiredVersion: deps['react-dom'] },
        'react-router-dom': {
          singleton: true,
          requiredVersion: deps['react-router-dom'],
        },
      },
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html',
      title: 'Aval - Aprobaciones',
    }),
  ],
  devServer: {
    port: 3000,
    historyApiFallback: true,
    hot: true,
    proxy: [
      {
        context: ['/api', '/mock-mail'],
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    ],
  },
};
