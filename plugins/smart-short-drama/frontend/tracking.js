import { invokeIpc } from './ipc.js';

export const TrackingPage = Object.freeze({
  ADX_SCRAPER: 'adx_scraper',
  REPLICATION: 'replication',
  REMIX: 'remix',
  HIGHLIGHT: 'highlight'
});

export const TrackingEvent = Object.freeze({
  ADX_START: 'adx_start_task',
  REPLICATION_START: 'replication_start_task',
  REMIX_START: 'remix_start_task',
  HIGHLIGHT_START: 'highlight_start_task',
  HIGHLIGHT_PARSE_DOWNLOAD_START: 'highlight_parse_download_start'
});

export const trackClick = (eventName, pageName) => {
  console.log('[Tracking] 准备上报点击事件:', {
    eventName,
    pageName
  });

  invokeIpc('event-tracking:track-click', {
    eventName,
    pageName
  })
    .then((result) => {
      console.log('[Tracking] 埋点上报返回:', {
        eventName,
        pageName,
        success: result?.success,
        message: result?.message,
        data: result?.data
      });
    })
    .catch((error) => {
      console.warn('[Tracking] 埋点上报失败:', {
        eventName,
        pageName,
        message: error?.message || String(error)
      });
    });
};
