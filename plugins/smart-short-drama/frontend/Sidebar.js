import { IconComponents } from './icons.js';
import { ViewState, AssetCategory } from './constants.js';

const { h } = Vue;

export const Sidebar = {
  props: ['currentView', 'currentAssetCategory'],
  emits: ['change-view', 'change-asset-category'],
  setup(props, { emit }) {
    const navItems = [
      { id: ViewState.DASHBOARD, label: '任务列表', icon: IconComponents.LayoutDashboard },
      { id: ViewState.ADX_SCRAPER, label: '爆款扒产', icon: IconComponents.Download },
      { id: ViewState.REPLICATION, label: '爆款复刻', icon: IconComponents.Copy },
      { id: ViewState.REMIX, label: '爆款混剪', icon: IconComponents.Scissors },
      { id: ViewState.HIGHLIGHT, label: '高光混剪', icon: IconComponents.Sparkles }
    ];

    const assetCategories = [
      { id: AssetCategory.RUNS, label: '跑量片段' },
      { id: AssetCategory.REPLICATION, label: '复刻片段' },
      { id: AssetCategory.DRAMA_FULL, label: '剧目库' },
      { id: AssetCategory.SCRIPTS, label: '录屏话术' },
      { id: AssetCategory.END_FRAMES, label: '尾帧库' }
    ];

    const handleAssetCategoryClick = (category) => {
      emit('change-view', ViewState.ASSETS);
      emit('change-asset-category', category);
    };

    return () =>
      h('div', { class: 'w-60 bg-white h-screen flex flex-col border-r border-gray-200 flex-shrink-0 z-20 font-sans' }, [
        h('div', { class: 'h-16 flex items-center px-6 border-b border-gray-100' }, [
          h('div', { class: 'w-8 h-8 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-md shadow-primary/20' }, [
            h(IconComponents.Clapperboard, { class: 'text-white w-5 h-5' })
          ]),
          h('h1', { class: 'text-lg font-bold text-gray-800 tracking-tight' }, '短剧智造')
        ]),
        h('div', { class: 'flex-1 overflow-y-auto py-6 px-4 space-y-6' }, [
          h('div', [
            h('div', { class: 'text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2' }, '工作台'),
            h(
              'nav',
              { class: 'space-y-1' },
              navItems.map((item) =>
                h(
                  'button',
                  {
                    key: item.id,
                    onClick: () => emit('change-view', item.id),
                    class: [
                      'w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-base font-medium transition-all',
                      props.currentView === item.id ? 'bg-blue-50 text-primary' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    ]
                  },
                  [
                    h(item.icon, {
                      class: ['w-5 h-5', props.currentView === item.id ? 'text-primary' : 'text-gray-400']
                    }),
                    h('span', item.label)
                  ]
                )
              )
            )
          ]),
          h('div', [
            h(
              'div',
              {
                class: 'flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2 cursor-pointer hover:text-primary transition-colors',
                onClick: () => emit('change-view', ViewState.ASSETS)
              },
              [h('span', '资源管理'), h(IconComponents.Folder, { class: 'w-3 h-3' })]
            ),
            h(
              'nav',
              { class: 'space-y-1' },
              assetCategories.map((cat) =>
                h(
                  'button',
                  {
                    key: cat.id,
                    onClick: () => handleAssetCategoryClick(cat.id),
                    class: [
                      'w-full flex items-center px-3 py-2.5 rounded-lg text-base transition-colors',
                      props.currentView === ViewState.ASSETS && props.currentAssetCategory === cat.id ? 'text-primary bg-blue-50 font-medium' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    ]
                  },
                  [
                    h('div', {
                      class: ['w-1.5 h-1.5 rounded-full mr-3', props.currentView === ViewState.ASSETS && props.currentAssetCategory === cat.id ? 'bg-primary' : 'bg-gray-300']
                    }),
                    h('span', cat.label)
                  ]
                )
              )
            )
          ])
        ])
      ]);
  }
};


