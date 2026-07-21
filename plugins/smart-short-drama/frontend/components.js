// Single-file components container (keeps DetailTable and ReadinessPanel only)
import { IconComponents } from './icons.js';
import { STATUS_TEXTS } from './constants.js';
import { invokeIpc } from './ipc.js';
const { h } = Vue;

export const DetailTable = {
  props: ['items', 'title'],
  setup(dtProps) {
    return () =>
      h('div', { class: 'bg-white border border-secondary rounded-lg overflow-hidden shadow-sm mb-4 last:mb-0' }, [
        dtProps.title
          ? h('div', { class: 'px-4 py-2 bg-gray-50 border-b border-secondary flex items-center gap-2 text-xs font-semibold text-textSecondary' }, [
              h(IconComponents.List, { class: 'w-3.5 h-3.5' }),
              h('span', dtProps.title)
            ])
          : null,
        h('table', { class: 'w-full text-sm' }, [
          h('thead', { class: 'bg-gray-50/50 text-textSecondary text-xs uppercase' }, [
            h('tr', [h('th', { class: 'px-4 py-2 text-left font-medium w-3/4' }, '内容名称'), h('th', { class: 'px-4 py-2 text-center font-medium w-1/4' }, '状态')])
          ]),
          h(
            'tbody',
            { class: 'divide-y divide-secondary' },
            dtProps.items && dtProps.items.length > 0
              ? dtProps.items.map((row, idx) =>
                  h('tr', { key: idx, class: ['hover:bg-gray-50', row.status === 'not_ready' ? 'bg-red-50/10' : ''] }, [
                    h('td', { class: 'px-4 py-2.5 text-textMain' }, row.content),
                    h('td', { class: 'px-4 py-2.5 text-center' }, [
                      h(
                        'span',
                        {
                          class: [
                            'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border',
                            row.status === 'ready'
                              ? 'text-success bg-success/5 border-success/10'
                              : row.status === 'partial'
                              ? 'text-warning bg-warning/5 border-warning/10'
                              : 'text-danger bg-danger/5 border-danger/10'
                          ]
                        },
                        [h(IconComponents.StatusIcon, { status: row.status, class: 'w-3 h-3' }), h('span', STATUS_TEXTS[row.status] || '未知')]
                      )
                    ])
                  ])
                )
              : [h('tr', [h('td', { colspan: 2, class: 'px-4 py-8 text-center text-gray-400' }, '无数据')])]
          )
        ])
      ]);
  }
};

export const ReadinessPanel = {
  props: ['items'],
  setup(props) {
    const expandedRow = Vue.ref(null);

    const toggleExpand = (id) => {
      expandedRow.value = expandedRow.value === id ? null : id;
    };

    const hasDetails = (item) => {
      // 如果有 details 对象，就显示查看详情按钮（即使列表为空）
      if (item.details) return true;
      if (Array.isArray(item.folderPaths) && item.folderPaths.length > 0) return true;
      // 或者有文件夹路径
      if (item.folderPath) return true;
      return false;
    };

    // Use centralized STATUS_TEXTS from constants.js

    return () =>
      h('div', { class: 'mb-8 bg-surface border border-secondary rounded-lg shadow-sm overflow-hidden animate-fade-in' }, [
        h('div', { class: 'px-5 py-4 border-b border-secondary bg-gray-50 flex items-center gap-2' }, [
          h('div', { class: 'p-1.5 bg-white border border-secondary rounded shadow-sm text-primary' }, [h(IconComponents.Database, { class: 'w-4 h-4' })]),
          h('h3', { class: 'text-base font-bold text-textMain' }, '数据源就绪状态监控')
        ]),
        h('div', { class: 'w-full overflow-x-auto' }, [
          h('table', { class: 'w-full text-left text-sm' }, [
            h('thead', [
              h('tr', { class: 'border-b border-secondary bg-gray-50/50 text-textSecondary' }, [
                h('th', { class: 'px-6 py-4 font-medium w-1/4 whitespace-nowrap' }, '数据源'),
                h('th', { class: 'px-6 py-4 font-medium text-center w-32 whitespace-nowrap' }, '状态'),
                h('th', { class: 'px-6 py-4 font-medium text-center w-32 whitespace-nowrap' }, '就绪时间'),
                h('th', { class: 'px-6 py-4 font-medium text-center w-40 whitespace-nowrap' }, '操作')
              ])
            ]),
            h(
              'tbody',
              { class: 'divide-y divide-secondary' },
              (props.items || []).map((item) => [
                h('tr', { class: ['hover:bg-gray-50 transition-colors', expandedRow.value === item.id ? 'bg-blue-50/20' : ''] }, [
                  h('td', { class: 'px-6 py-4 text-textMain font-medium text-base whitespace-nowrap' }, item.name),
                  h('td', { class: 'px-6 py-4 text-center whitespace-nowrap' }, [
                    h('div', { class: 'inline-flex items-center justify-center gap-1.5 bg-white border border-secondary px-3 py-1 rounded-full shadow-sm min-w-[90px]' }, [
                      h(IconComponents.StatusIcon, { status: item.status, class: 'w-3 h-3' }),
                      h(
                        'span',
                        { class: ['text-xs font-bold', item.status === 'ready' ? 'text-success' : item.status === 'partial' ? 'text-warning' : 'text-danger'] },
                        STATUS_TEXTS[item.status] || '未知'
                      )
                    ])
                  ]),
                  h('td', { class: 'px-6 py-4 text-center text-textSecondary font-mono whitespace-nowrap' }, item.status !== 'not_ready' ? item.readyTime || '--:--' : '-'),
                  h('td', { class: 'px-6 py-4 text-center whitespace-nowrap flex items-center justify-center gap-2' }, [
                    hasDetails(item)
                      ? h(
                          'button',
                          {
                            onClick: () => toggleExpand(item.id),
                            class: [
                              'inline-flex items-center justify-center gap-1 text-xs font-medium px-4 py-1.5 rounded-md transition-colors border',
                              expandedRow.value === item.id ? 'bg-primary text-white border-primary' : 'bg-white text-textRegular border-secondary hover:text-primary hover:border-primary'
                            ]
                          },
                          expandedRow.value === item.id ? '收起详情' : '查看详情'
                        )
                      : h('span', { class: 'text-gray-300 w-[86px] inline-block' }, '-')
                  ])
                ]),
                expandedRow.value === item.id
                  ? h('tr', { class: 'bg-gray-50/30 animate-fade-in shadow-inner' }, [
                      h('td', { colspan: 4, class: 'p-0' }, [
                        h('div', { class: 'p-6 max-w-5xl mx-auto' }, [
                          Array.isArray(item.folderPaths) && item.folderPaths.length > 0
                            ? h(
                                'div',
                                { class: 'mb-4 space-y-2' },
                                item.folderPaths.map((source, idx) =>
                                  h('div', { key: idx, class: 'bg-white border border-secondary rounded-lg p-3 flex items-center justify-between shadow-sm' }, [
                                    h('div', { class: 'flex items-center gap-2 text-textSecondary overflow-hidden' }, [
                                      h(IconComponents.FolderOpen, { class: 'w-4 h-4 flex-shrink-0 text-primary' }),
                                      h('span', { class: 'text-xs font-mono truncate max-w-md', title: source.path }, `${source.label || '本地源'}: ${source.path}`)
                                    ]),
                                    h(
                                      'button',
                                      {
                                        onClick: async () => {
                                          try {
                                            await invokeIpc('open-folder', source.path);
                                            console.log('[ReadinessPanel] 打开文件夹:', source.path);
                                          } catch (error) {
                                            console.error('[ReadinessPanel] 打开文件夹失败:', error);
                                            console.error('[ReadinessPanel] 错误详情:', error.message);
                                          }
                                        },
                                        class:
                                          'flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 text-primary hover:bg-primary/10 rounded border border-primary/20 transition-colors text-xs font-medium whitespace-nowrap'
                                      },
                                      [h(IconComponents.FolderOpen, { class: 'w-3.5 h-3.5' }), '打开文件夹']
                                    )
                                  ])
                                )
                              )
                            : item.folderPath
                            ? h('div', { class: 'mb-4 bg-white border border-secondary rounded-lg p-3 flex items-center justify-between shadow-sm' }, [
                                h('div', { class: 'flex items-center gap-2 text-textSecondary overflow-hidden' }, [
                                  h(IconComponents.FolderOpen, { class: 'w-4 h-4 flex-shrink-0 text-primary' }),
                                  h('span', { class: 'text-xs font-mono truncate max-w-md', title: item.folderPath }, `本地源: ${item.folderPath}`)
                                ]),
                                h(
                                  'button',
                                  {
                                    onClick: async () => {
                                      try {
                                        await invokeIpc('open-folder', item.folderPath);
                                        console.log('[ReadinessPanel] 打开文件夹:', item.folderPath);
                                      } catch (error) {
                                        console.error('[ReadinessPanel] 打开文件夹失败:', error);
                                        console.error('[ReadinessPanel] 错误详情:', error.message);
                                      }
                                    },
                                    class:
                                      'flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 text-primary hover:bg-primary/10 rounded border border-primary/20 transition-colors text-xs font-medium whitespace-nowrap'
                                  },
                                  [h(IconComponents.FolderOpen, { class: 'w-3.5 h-3.5' }), '打开文件夹']
                                )
                              ])
                            : null,
                          item.details && item.details.groups
                            ? item.details.groups.map((group, gi) => h(DetailTable, { key: gi, items: group.items, title: group.title }))
                            : item.details
                            ? h(DetailTable, {
                                items: [
                                  ...(item.details.readyList || []).map((c) => ({ content: c, status: 'ready' })),
                                  ...(item.details.missingList || []).map((c) => ({ content: c, status: 'not_ready' }))
                                ],
                                title: '详细内容清单'
                              })
                            : null
                        ])
                      ])
                    ])
                  : null
              ])
            )
          ])
        ])
      ]);
  }
};
