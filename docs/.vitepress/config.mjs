import { defineConfig } from 'vitepress';

// API Pages configuration
const apiPages = {
  sidebars: [
    {
      text: 'API Reference',
      items: [
        { text: 'Overview', link: '/api/' },
        { text: 'Authentication', link: '/api/authentication' },
        { text: 'Rate Limits', link: '/api/rate-limits' },
        { text: 'Error Codes', link: '/api/error-codes' },
        {
          text: 'Endpoints',
          collapsed: false,
          items: [
            { text: 'Incidents', link: '/api/endpoints/incidents' },
            { text: 'Reports', link: '/api/endpoints/reports' },
            { text: 'Hotspots', link: '/api/endpoints/hotspots' },
            { text: 'Countries', link: '/api/endpoints/countries' },
            { text: 'Ports', link: '/api/endpoints/ports' }
          ]
        }
      ]
    }
  ]
};

export default defineConfig({
  title: 'MARA Documentation',
  description: 'Documentation for the Maritime Risk Analysis system',
  
  // Base URL for GitHub Pages
  base: '/mara/',
  
  // Ignore dead links for now
  ignoreDeadLinks: true,
  
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
      { text: 'Components', link: '/components/' },
      { text: 'Data Pipeline', link: '/data-pipeline/' },
      { text: 'Deduplication', link: '/deduplication/' },
      { text: 'Flash Reports', link: '/flash-report/' },
      { text: 'Weekly Reports', link: '/weekly-report/' },
      { text: 'API', link: '/api/' }
    ],
    
    // Sidebar navigation
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Architecture', link: '/guide/architecture' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Deployment', link: '/guide/deployment' }
          ]
        }
      ],
      '/components/': [
        {
          text: 'UI Components',
          items: [
            { text: 'Overview', link: '/components/' },
            { text: 'PDF Download Button', link: '/components/pdf-download-button' },
            { text: 'Maritime Map', link: '/components/maritime-map' }
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
      '/weekly-report/': [
        {
          text: 'Weekly Reports',
          items: [
            { text: 'Overview', link: '/weekly-report/' },
            { text: 'Implementation', link: '/weekly-report/implementation' },
            { text: 'Date Handling', link: '/weekly-report/date-handling' },
            { text: 'Data Flow', link: '/weekly-report/data-flow' },
            { text: 'API Reference', link: '/weekly-report/api-reference' }
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