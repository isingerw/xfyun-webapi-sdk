import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  root: 'demo',
  publicDir: false,
  server: {
    port: 5175,
    host: true,
    allowedHosts: ['y0t7eazyr435.ngrok.xiaomiqiu123.top'],
    proxy: {
      // 代理讯飞API请求到后端服务器
      '/api/v1/xfyun': {
        target: 'http://127.0.0.1:8083',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/v1\/xfyun/, '/api/v1/xfyun')
      },
      // 代理讯飞API直接请求
      '/v1/private': {
        target: 'https://api-dx.xf-yun.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => {
          // 保持完整的路径和查询参数
          console.log('代理路径重写:', path);
          return path;
        },
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('代理请求到讯飞API:', proxyReq.path);
            console.log('代理请求头:', proxyReq.getHeaders());
            console.log('原始URL:', req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('讯飞API响应状态:', proxyRes.statusCode);
            console.log('讯飞API响应头:', proxyRes.headers);
          });
        }
      }
    }
  },
  plugins: [react(), vue()],
  resolve: {
    alias: {
      'xfyun-webapi-sdk': path.resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    include: ['antd', 'react', 'react-dom', 'vue']
  }
})



