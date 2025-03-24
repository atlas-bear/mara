import { defineConfig } from 'vitepress'
import { generateApiPages } from 'vitepress-jsdoc'

// Generate API documentation
const apiPages = generateApiPages({
  rootDir: '../functions',
  scanPatterns: ['*.js', 'utils/*.js'],
  outputDir: './api',
  jsdocConfigPath: './.jsdoc.json'
})

export default defineConfig({
  title: 'MARA Documentation',
  description: 'Documentation for the Maritime Risk Analysis system',
  
  // Base URL for GitHub Pages - change to '/mara/' for production
  // Use '/' for local development, '/mara/' when deployed to GitHub Pages
  base: '/mara/',
  
  head: [
    ['link', { rel: 'icon', href: 'https://drive.google.com/uc?id=1OB5Lwgpp03DB9vs50T_kkKzL5VV_y5Eo', type: 'image/png' }]
  ],
  
  // Theme configuration
  themeConfig: {
    logo: 'https://drive.google.com/uc?id=1OB5Lwgpp03DB9vs50T_kkKzL5VV_y5Eo',
    
    // Top navigation
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'Data Pipeline', link: '/data-pipeline/' },
      { text: 'Deduplication', link: '/deduplication/' },
      { text: 'Flash Reports', link: '/flash-report/' },
      { text: 'API', link: '/api/' }
    ],
    
    // Sidebar navigation
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Architecture', link: '/guide/architecture' }
          ]
        }
      ],
      '/data-pipeline/': [
        {
          text: 'Data Pipeline',
          items: [
            { text: 'Overview', link: '/data-pipeline/' },
            { text: 'Data Collection', link: '/data-pipeline/data-collection' },
            { text: 'Data Processing', link: '/data-pipeline/data-processing' },
            { text: 'Troubleshooting', link: '/data-pipeline/troubleshooting' }
          ]
        }
      ],
      '/deduplication/': [
        {
          text: 'Cross-Source Deduplication',
          items: [
            { text: 'Overview', link: '/deduplication/' },
            { text: 'Implementation', link: '/deduplication/implementation' },
            { text: 'Troubleshooting', link: '/deduplication/troubleshooting' }
          ]
        }
      ],
      '/flash-report/': [
        {
          text: 'Flash Reports',
          items: [
            { text: 'Overview', link: '/flash-report/' },
            { text: 'API Reference', link: '/flash-report/api-reference' },
            { text: 'Architecture', link: '/flash-report/architecture' },
            { text: 'Automation', link: '/flash-report/automation-system' },
            { text: 'Cache Implementation', link: '/flash-report/cache-implementation' },
            { text: 'Integration Guide', link: '/flash-report/integration-guide' },
            { text: 'Testing Guide', link: '/flash-report/testing-guide' }
          ]
        }
      ],
      '/api/': apiPages.sidebars
    },
    
    // Footer
    footer: {
      message: 'Released under the Internal License.',
      copyright: 'Copyright © 2023-present Atlas Bear'
    },
    
    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/atlas-bear/mara' }
    ],
    
    // Search
    search: {
      provider: 'local'
    }
  }
})