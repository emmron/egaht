export default {
  mode: 'development',
  outDir: 'dist',
  publicDir: 'public',
  compiler: {
    targets: ['chrome91', 'firefox89', 'safari14'],
    optimization: 'balanced',
    sourceMaps: true
  },
  devServer: {
    port: 3000,
    hmr: true
  }
}