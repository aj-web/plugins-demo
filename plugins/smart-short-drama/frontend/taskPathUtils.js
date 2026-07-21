export const normalizeOutputPaths = (value) => {
  if (Array.isArray(value)) {
    return value.map((p) => String(p || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);
  }

  return [];
};

export const parentFolderOfFirstPath = (value) => {
  const firstPath = normalizeOutputPaths(value)[0] || '';
  if (!firstPath) {
    return '';
  }

  const parts = firstPath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 1) {
    return firstPath;
  }

  parts.pop();
  return parts.join('\\');
};

export const getTaskDate = (task) => {
  const text = task?.completedAt || task?.createdAt || '';
  const match = String(text).match(/\d{4}-\d{2}-\d{2}/);
  if (match) {
    return match[0];
  }

  const timestamp = Number(task?.id);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  return '';
};

export const joinPath = (...parts) =>
  parts
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== '')
    .map((part) => String(part).replace(/[\\/]+$/g, '').replace(/^[\\/]+/g, ''))
    .join('\\');

export const buildDatedFolder = (basePath, folderName, dateStr, sourceName = '') => {
  if (!basePath || !dateStr) {
    return '';
  }

  return sourceName ? joinPath(basePath, folderName, dateStr, sourceName) : joinPath(basePath, folderName, dateStr);
};

