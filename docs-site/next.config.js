const path = require('path');
const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.jsx'
})

module.exports = withNextra({
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true
  },
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '/')
  }
})