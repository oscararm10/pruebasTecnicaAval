const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

require('dotenv').config({ path: path.join(__dirname, '.env') });

const deps = require('./package.json').dependencies;
const API_BASE_URL = (process.env.API_BASE_URL || '').replace(/\/$/, '');

function buildApiProxy() {
  if (!API_BASE_URL) {
    return {
      context: ['/api'],
      target: 'http://localhost:4000',
      changeOrigin: true,
    };
  }

  const url = new URL(API_BASE_URL);
  const stagePath = url.pathname.replace(/\/$/, ''); // e.g. /Prod
  return {
    context: ['/api'],
    target: url.origin,
    changeOrigin: true,
    secure: true,
    pathRewrite: stagePath
      ? { '^/api': `${stagePath}/api` }
      : undefined,
  };
}

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
    new webpack.DefinePlugin({
      'process.env.API_BASE_URL': JSON.stringify(API_BASE_URL),
    }),
    {
      apply(compiler) {
        compiler.hooks.environment.tap('LogApiBase', () => {
          console.log(
            `[aval] API_BASE_URL=${API_BASE_URL || '(vacío → proxy local :4000)'}`
          );
        });
      },
    },
  ],
  devServer: {
    port: 3000,
    historyApiFallback: true,
    hot: true,
    // Solo /api: /mock-mail es ruta SPA del frontend; el API es GET /api/mock-mail
    proxy: [buildApiProxy()],
  },
};
