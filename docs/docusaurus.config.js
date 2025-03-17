// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import { themes as prismThemes } from "prism-react-renderer";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "MARA Documentation",
  tagline:
    "Multi-source Analysis and Reporting Architecture for monitoring security-related incidents with integrated intelligence reports, daily hot spots, and comprehensive country and port indices.",
  favicon: "img/favicon.ico",

  // Set the production url of your site here
  url: "https://atlas-bear.github.io",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/mara/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "atlas-bear", // Usually your GitHub org/user name.
  projectName: "mara", // Usually your repo name.
  trailingSlash: false,

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: "./sidebars.js",
          routeBasePath: "/",
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          //editUrl:
          //  "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          //editUrl:
          //  "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
          // Useful options to enforce blogging best practices
          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
        },
        theme: {
          customCss: [
            "./src/css/custom.css",
          ],
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: "img/mara-social-card.png",
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: "MARA Documentation",
        logo: {
          alt: "MARA Logo",
          src: "img/mara_logo.svg",
        },
        items: [
          {
            type: "docSidebar",
            sidebarId: "tutorialSidebar",
            position: "left",
            label: "Documentation",
          },
          { to: "/api", label: "API", position: "left" },
          { to: "/blog", label: "Updates", position: "left" },
          {
            type: 'dropdown',
            label: 'Support',
            position: 'right',
            items: [
              {
                label: 'FAQ',
                to: '/faq',
              },
              {
                label: 'Community Forum',
                to: '/community',
              },
              {
                label: 'Contact Us',
                to: '/contact',
              },
            ],
          },
          {
            href: "https://github.com/atlas-bear/mara",
            className: "header-github-link",
            "aria-label": "GitHub repository",
            position: "right",
          },
        ],
      },
      docs: {
        sidebar: {
          hideable: true,
          autoCollapseCategories: true,
        },
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Documentation",
            items: [
              {
                label: "Getting Started",
                to: "/getting-started",
              },
              {
                label: "API Reference",
                to: "/api",
              },
              {
                label: "Tutorials",
                to: "/tutorials",
              },
            ],
          },
          {
            title: "Community",
            items: [
              {
                label: "GitHub Discussions",
                href: "https://github.com/atlas-bear/mara/discussions",
              },
              {
                label: "Discord",
                href: "https://discord.gg/atlas-bear",
              },
              {
                label: "Twitter",
                href: "https://twitter.com/atlas_bear",
              },
            ],
          },
          {
            title: "More",
            items: [
              {
                label: "Updates",
                to: "/blog",
              },
              {
                label: "GitHub",
                href: "https://github.com/atlas-bear/mara",
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Atlas Bear. All rights reserved.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'diff', 'json', 'python', 'typescript'],
        defaultLanguage: 'javascript',
        magicComments: [
          {
            className: 'theme-code-block-highlighted-line',
            line: 'highlight-next-line',
            block: { start: 'highlight-start', end: 'highlight-end' },
          },
          {
            className: 'code-block-error-line',
            line: 'error-next-line',
            block: { start: 'error-start', end: 'error-end' },
          },
        ],
      },
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 4,
      },
    }),
  
  // Add plugins for enhanced functionality
  plugins: [
    [
      require.resolve('@docusaurus/plugin-content-docs'),
      {
        id: 'api',
        path: 'api',
        routeBasePath: 'api',
        sidebarPath: require.resolve('./sidebarsApi.js'),
      },
    ],
  ],
};

export default config;
