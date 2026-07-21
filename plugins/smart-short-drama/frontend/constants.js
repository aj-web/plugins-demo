// 基础常量与 Mock 数据，供各组件与页面复用

export const TaskStatus = {
  PENDING: '待执行', // 任务队列中等待执行
  RUNNING: '执行中', // 正在执行
  COMPLETED: '已完成', // 执行成功
  FAILED: '失败' // 执行失败
};

export const TaskModule = {
  ADX: '爆款扒产',
  REPLICATION: '爆款复刻',
  REMIX: '爆款混剪',
  HIGHLIGHT: '高光混剪'
};

export const AssetCategory = {
  RUNS: 'run_clips',
  REPLICATION: 'replication_clips',
  DRAMA_FULL: 'drama_full',
  SCRIPTS: 'scripts',
  END_FRAMES: 'end_frames'
};

export const ViewState = {
  DASHBOARD: 'dashboard',
  ASSETS: 'assets',
  ADX_SCRAPER: 'adx_scraper',
  REPLICATION: 'replication',
  REMIX: 'remix',
  HIGHLIGHT: 'highlight'
};

// Readiness mock data for ADX and Replication pages
export const ADX_READINESS = [];

export const REPLICATION_READINESS = [
  {
    id: 'dramaList',
    name: '剧目列表 Excel',
    status: 'not_ready',
    readyTime: '--:--:--',
    folderPath: '',
    details: {
      readyList: [],
      missingList: ['未上传剧目列表 Excel']
    }
  },
  {
    id: 'runs',
    name: '跑量片段',
    status: 'ready',
    readyTime: '09:00:00',
    folderPath: 'D:/ShortDrama/Assets/RunClips',
    details: { readyList: ['重生之龙王赘婿 (12个片段)', '霸道总裁爱上我 (5个片段)'], missingList: [] }
  },
  {
    id: 'dramaOriginal',
    name: '短剧原片',
    status: 'partial',
    readyTime: '09:10:00',
    folderPath: 'D:/ShortDrama/Assets/Originals',
    details: { readyList: ['重生之龙王赘婿 (80/100集)'], missingList: ['霸道总裁爱上我 (0/80集)'] }
  }
];

// Status text mapping for UI labels
export const STATUS_TEXTS = {
  ready: '已就绪',
  partial: '部分就绪',
  not_ready: '未就绪',
  loading: '加载中'
};
