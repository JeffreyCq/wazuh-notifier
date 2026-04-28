const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env = {}) => ({
  mode: 'production',
  devtool: false,
  entry: {
    background: './src/background/index.ts',
    popup: './src/popup/index.ts',
    options: './src/options/index.ts',
  },
  output: {
    path: path.resolve(__dirname, env.firefox ? 'dist/firefox' : 'dist/chrome'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/popup/index.html',
      filename: 'popup.html',
      chunks: ['popup'],
      inject: 'body',
    }),
    new HtmlWebpackPlugin({
      template: './src/options/index.html',
      filename: 'options.html',
      chunks: ['options'],
      inject: 'body',
    }),
    new CopyPlugin({
      patterns: [
        {
          from: env.firefox ? 'manifest.firefox.json' : 'manifest.json',
          to: 'manifest.json',
        },
        { from: 'public', to: '.' },
      ],
    }),
  ],
  optimization: {
    minimize: false,
  },
});
