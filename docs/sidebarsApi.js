/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebarsApi = {
  apiSidebar: [
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'overview',
        'authentication',
        {
          type: 'category',
          label: 'Endpoints',
          items: [
            'endpoints/incidents',
            'endpoints/reports',
            'endpoints/hotspots',
            'endpoints/countries',
            'endpoints/ports',
          ],
        },
        'error-codes',
        'rate-limits',
        'changelog',
      ],
    },
  ],
};

module.exports = sidebarsApi;
