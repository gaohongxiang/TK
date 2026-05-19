const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1';

function dbBase(config) {
  return `${FIRESTORE_BASE}/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents`;
}

function documentUrl(config, path) {
  return `${dbBase(config)}/${path.split('/').map(encodeURIComponent).join('/')}?key=${encodeURIComponent(config.apiKey)}`;
}

function collectionUrl(config, collectionName, params = {}) {
  const url = new URL(`${dbBase(config)}/${encodeURIComponent(collectionName)}`);
  url.searchParams.set('key', config.apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)]))
      }
    };
  }
  return { stringValue: String(value) };
}

function fromFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('stringValue' in value) return String(value.stringValue);
  if ('timestampValue' in value) return String(value.timestampValue);
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) return documentFieldsToObject(value.mapValue.fields || {});
  return null;
}

function documentFieldsToObject(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

function toFirestoreDocument(data) {
  return {
    fields: Object.fromEntries(Object.entries(data || {}).map(([key, value]) => [key, firestoreValue(value)]))
  };
}

function updateMaskParams(data) {
  const params = new URLSearchParams();
  for (const key of Object.keys(data || {})) params.append('updateMask.fieldPaths', key);
  return params.toString();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  if (!response.ok) {
    const message = body?.error?.message || body?.raw || response.statusText;
    const error = new Error(`Firestore 请求失败：${message}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function docId(name) {
  return String(name || '').split('/').pop();
}

function docFromApi(document) {
  return {
    id: docId(document.name),
    name: document.name,
    data: documentFieldsToObject(document.fields || {})
  };
}

function createFirestoreClient(config) {
  async function list(collectionName, params = {}) {
    const body = await requestJson(collectionUrl(config, collectionName, params));
    return (body?.documents || []).map(docFromApi);
  }

  async function listAll(collectionName, params = {}) {
    const all = [];
    let pageToken = '';
    do {
      const page = pageToken ? { ...params, pageToken } : params;
      const body = await requestJson(collectionUrl(config, collectionName, page));
      all.push(...(body?.documents || []).map(docFromApi));
      pageToken = body?.nextPageToken || '';
    } while (pageToken);
    return all;
  }

  async function get(path) {
    const body = await requestJson(documentUrl(config, path));
    return docFromApi(body);
  }

  async function patch(path, data) {
    const url = `${documentUrl(config, path)}&${updateMaskParams(data)}`;
    const body = await requestJson(url, {
      method: 'PATCH',
      body: JSON.stringify(toFirestoreDocument(data))
    });
    return docFromApi(body);
  }

  async function remove(path) {
    await requestJson(documentUrl(config, path), { method: 'DELETE' });
  }

  async function probeWrite() {
    const id = `cli_${Date.now().toString(36)}`;
    await patch(`_tk_probe/${id}`, {
      source: 'tk-cli',
      createdAt: new Date().toISOString()
    });
    await remove(`_tk_probe/${id}`).catch(() => {});
    return true;
  }

  return {
    config,
    get,
    list,
    listAll,
    patch,
    probeWrite,
    remove
  };
}

function isPermissionDenied(error) {
  return error?.status === 403 || /permission|PERMISSION_DENIED|Missing or insufficient permissions/i.test(String(error?.message || ''));
}

export {
  createFirestoreClient,
  isPermissionDenied
};
