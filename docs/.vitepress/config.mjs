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
  description: 'TikTok Shop 日本跨境店工具箱文档：利润计算、Firebase 商品订单管理、本地 Excel 数据分析和 TK 运营资料。',
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
          { text: '订单管理', link: '/guide/orders' },
          { text: '数据分析', link: '/guide/analytics' },
          { text: '部署发布', link: '/guide/deploy' },
          { text: '常见问题', link: '/guide/faq' }
        ]
      },
      {
        text: 'TK运营',
        collapsed: false,
        items: [
          { text: '日本站官方学习中心', link: '/ops/jp-official-learning-center' },
          {
            text: '选品',
            collapsed: false,
            items: [
              { text: '选品原则', link: '/ops/selection-principles' },
              { text: '爆款拆解与延伸', link: '/ops/selection-explosive' },
              { text: '小卖家打法', link: '/ops/selection-small-seller' }
            ]
          },
          { text: 'AI 视频日更', link: '/ops/ai-video-daily' },
          { text: '优惠券与秒杀', link: '/ops/promotions' },
          { text: '运营话术', link: '/ops/scripts' }
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
    ['meta', { name: 'theme-color', content: '#ffffff' }],
    ['meta', { name: 'robots', content: 'index,follow' }],
    ['meta', { name: 'description', content: 'TikTok Shop 日本跨境店工具箱文档：Firebase 商品订单管理、本地 Excel 数据分析、Cloudflare Pages 部署和 TK 运营资料。' }]
  ]
};
