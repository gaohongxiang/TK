export default {
  lang: 'zh-CN',
  base: '/',
  srcExclude: [
    'public/**/*.md',
    'superpowers/**'
  ],
  ignoreDeadLinks: [
    /\/firebase\/order-tracker-firestore\.rules$/,
    /\/supabase\/order-tracker-schema\.sql$/
  ],
  title: 'TK 电商工具箱文档',
  description: '利润计算器、商品管理、订单管理，以及 TK 运营选品与话术。',
  cleanUrls: true,
  themeConfig: {
    siteTitle: 'TK 电商工具箱文档',
    nav: [
      { text: '概览', link: '/guide/overview' },
      { text: '工具使用', link: '/guide/database' },
      { text: 'TK运营', link: '/ops/selection-principles' },
      { text: '返回工具', link: 'https://tk-evu.pages.dev/' }
    ],
    sidebar: [
      {
        text: '工具使用',
        collapsed: false,
        items: [
          { text: '概览', link: '/guide/overview' },
          { text: '数据库', link: '/guide/database' },
          { text: '利润计算器', link: '/guide/calculator' },
          { text: '商品管理', link: '/guide/products' },
          { text: '订单管理', link: '/guide/orders' }
        ]
      },
      {
        text: 'TK运营',
        collapsed: false,
        items: [
          {
            text: '选品',
            collapsed: false,
            items: [
              { text: '选品原则', link: '/ops/selection-principles' },
              { text: '爆款拆解与延伸', link: '/ops/selection-explosive' },
              { text: '小卖家打法', link: '/ops/selection-small-seller' }
            ]
          },
          { text: '运营话术', link: '/ops/scripts' }
        ]
      },
      {
        text: '补充',
        collapsed: true,
        items: [
          { text: '常见问题', link: '/guide/faq' }
        ]
      }
    ],
    outline: {
      level: [2, 3]
    },
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },
    search: {
      provider: 'local'
    }
  },
  head: [
    ['meta', { name: 'theme-color', content: '#ffffff' }]
  ]
};
