import { IconComponents } from './icons.js';
import { TaskStatus } from './constants.js';

const { h } = Vue;

export const TaskDashboard = {
  props: ['tasks'],
  emits: ['retry', 'open-folder'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'p-8 h-full flex flex-col animate-fade-in bg-background' }, [
        h('div', { class: 'mb-6 flex justify-between items-center' }, [
          h('h2', { class: 'text-2xl font-bold text-textMain flex items-center gap-2' }, [h(IconComponents.List, { class: 'w-6 h-6 text-primary' }), h('span', '任务列表 (Task Queue)')]),
          h('div', { class: 'flex gap-2' }, [
            h('div', { class: 'bg-white border border-secondary px-4 py-2 rounded-lg text-sm text-textRegular shadow-sm' }, [
              h('span', 'Total Tasks: '),
              h('span', { class: 'text-primary font-bold ml-1' }, props.tasks?.length || 0)
            ])
          ])
        ]),
        h('div', { class: 'bg-surface rounded-xl border border-secondary overflow-hidden flex-1 shadow-sm flex flex-col' }, [
          h('div', { class: 'overflow-auto flex-1', style: 'max-height: calc(100vh - 250px);' }, [
            h('table', { class: 'w-full text-center border-collapse' }, [
              h('thead', { class: 'sticky top-0 z-10' }, [
                h('tr', { class: 'bg-gray-50 border-b border-secondary text-textSecondary text-sm uppercase tracking-wide' }, [
                  h('th', { class: 'p-5 font-semibold bg-gray-50' }, '任务名称 (ID/Time)'),
                  h('th', { class: 'p-5 font-semibold bg-gray-50' }, '功能模块'),
                  h('th', { class: 'p-5 font-semibold bg-gray-50' }, '创建时间'),
                  h('th', { class: 'p-5 font-semibold bg-gray-50' }, '状态'),
                  h('th', { class: 'p-5 font-semibold bg-gray-50' }, '操作')
                ])
              ]),
              h('tbody', { class: 'divide-y divide-secondary' }, [
                props.tasks && props.tasks.length > 0
                  ? props.tasks.map((task) =>
                      h('tr', { key: task.id, class: 'hover:bg-blue-50/30 transition-colors group bg-white' }, [
                        h('td', { class: 'p-5' }, [h('div', { class: 'font-medium text-textMain font-mono text-sm' }, task.name)]),
                        h('td', { class: 'p-5' }, [h('span', { class: 'inline-block px-3 py-1 rounded bg-gray-100 text-xs text-textRegular border border-gray-200' }, task.module)]),
                        h('td', { class: 'p-5 text-textSecondary text-sm font-mono' }, task.createdAt),
                        h('td', { class: 'p-5' }, [
                          h('div', { class: 'flex justify-center' }, [
                            task.status === TaskStatus.RUNNING
                              ? h('span', { class: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20' }, [
                                  h(IconComponents.PlayCircle, { class: 'w-3 h-3 animate-pulse' }),
                                  h('span', '执行中')
                                ])
                              : task.status === TaskStatus.COMPLETED
                              ? h('span', { class: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20' }, [
                                  h(IconComponents.CheckCircle2, { class: 'w-3 h-3' }),
                                  h('span', '已完成')
                                ])
                              : task.status === TaskStatus.FAILED
                              ? h('span', { class: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-danger/10 text-danger border border-danger/20' }, [
                                  h(IconComponents.AlertCircle, { class: 'w-3 h-3' }),
                                  h('span', '失败')
                                ])
                              : h('span', { class: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200' }, [
                                  h(IconComponents.Clock, { class: 'w-3 h-3' }),
                                  h('span', '待执行')
                                ])
                          ])
                        ]),
                        h('td', { class: 'p-5' }, [
                          h('div', { class: 'flex items-center justify-center gap-3' }, [
                            task.status === TaskStatus.RUNNING
                              ? h('span', { class: 'text-xs text-textSecondary' }, '-')
                              : task.status === TaskStatus.COMPLETED
                              ? h(
                              'button',
                              {
                                    onClick: () => emit('open-folder', task.id),
                                class:
                                  'flex items-center gap-1 px-3 py-1.5 bg-white border border-secondary hover:border-primary hover:text-primary rounded text-textSecondary transition-colors text-xs shadow-sm',
                                title: '打开文件夹'
                              },
                              [h(IconComponents.FolderOpen, { class: 'w-3.5 h-3.5' }), h('span', '打开')]
                                )
                              : task.status === TaskStatus.FAILED
                              ? h(
                                  'button',
                                  {
                                    onClick: () => emit('retry', task.id),
                                    class:
                                      'flex items-center gap-1 px-3 py-1.5 bg-white border border-secondary hover:border-primary hover:text-primary rounded text-textSecondary transition-colors text-xs shadow-sm',
                                    title: '重试任务'
                                  },
                                  [h(IconComponents.RotateCw, { class: 'w-3.5 h-3.5' }), h('span', '重试')]
                                )
                              : h('span', { class: 'text-xs text-textSecondary' }, '-')
                          ])
                        ])
                      ])
                    )
                  : h('tr', [
                      h('td', { colspan: 5, class: 'p-16 text-center text-textSecondary bg-white' }, [
                        h('div', { class: 'flex flex-col items-center' }, [h(IconComponents.List, { class: 'w-12 h-12 text-gray-200 mb-2' }), h('span', '暂无任务记录')])
                      ])
                    ])
              ])
            ])
          ])
        ])
      ]);
  }
};
