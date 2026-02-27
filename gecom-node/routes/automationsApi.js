const express = require('express');

const router = express.Router();

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_API_BASE_URL || process.env.API_BASE_URL;
  if (!baseUrl) {
    throw new Error('Missing BACKEND_API_BASE_URL (or API_BASE_URL) env var.');
  }
  return baseUrl.replace(/\/$/, '');
}

function backendUrl(path) {
  const baseUrl = getBackendBaseUrl();
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function withQuery(url, query) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const raw = String(value).trim();
    if (!raw) return;
    params.append(key, raw);
  });

  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

function getAuthHeader(req) {
  const headerAuth = req.headers.authorization;
  if (headerAuth && headerAuth.startsWith('Bearer ')) return headerAuth;

  const token = req.cookies?.token || req.cookies?.access_token;
  if (token) return `Bearer ${token}`;

  return null;
}

async function readJsonSafe(response) {
  const text = await response.text().catch(() => '');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function proxyJson(req, res, config) {
  const authHeader = getAuthHeader(req);
  const response = await fetch(config.url, {
    method: config.method,
    headers: {
      Accept: 'application/json',
      ...(config.withBody ? { 'Content-Type': 'application/json' } : {}),
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    ...(config.withBody ? { body: JSON.stringify(req.body ?? {}) } : {}),
  });

  const data = await readJsonSafe(response);
  return res.status(response.status).json(data ?? {});
}

router.get('/automations', async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: 'GET',
      url: backendUrl('/automations'),
    });
  } catch (error) {
    console.error('GET /api/automations error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/automations/metadata/entities', async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: 'GET',
      url: backendUrl('/automations/metadata/entities'),
    });
  } catch (error) {
    console.error('GET /api/automations/metadata/entities error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/automations/metadata/entities/:entityName/fields', async (req, res) => {
  try {
    const entityName = String(req.params?.entityName || '').trim().toLowerCase();
    if (!entityName) return res.status(400).json({ message: 'Validation error.', missing: ['entityName'] });

    return await proxyJson(req, res, {
      method: 'GET',
      url: backendUrl(`/automations/metadata/entities/${encodeURIComponent(entityName)}/fields`),
    });
  } catch (error) {
    console.error('GET /api/automations/metadata/entities/:entityName/fields error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/automations/metadata/entities/:entityName/records', async (req, res) => {
  try {
    const entityName = String(req.params?.entityName || '').trim().toLowerCase();
    if (!entityName) return res.status(400).json({ message: 'Validation error.', missing: ['entityName'] });

    return await proxyJson(req, res, {
      method: 'GET',
      url: withQuery(
        backendUrl(`/automations/metadata/entities/${encodeURIComponent(entityName)}/records`),
        req.query,
      ),
    });
  } catch (error) {
    console.error('GET /api/automations/metadata/entities/:entityName/records error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/automations', async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: 'POST',
      url: backendUrl('/automations'),
      withBody: true,
    });
  } catch (error) {
    console.error('POST /api/automations error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/automations/:id', async (req, res) => {
  try {
    const id = String(req.params?.id || '').trim();
    if (!id) return res.status(400).json({ message: 'Validation error.', missing: ['id'] });

    return await proxyJson(req, res, {
      method: 'GET',
      url: backendUrl(`/automations/${encodeURIComponent(id)}`),
    });
  } catch (error) {
    console.error('GET /api/automations/:id error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/automations/:id', async (req, res) => {
  try {
    const id = String(req.params?.id || '').trim();
    if (!id) return res.status(400).json({ message: 'Validation error.', missing: ['id'] });

    return await proxyJson(req, res, {
      method: 'PUT',
      url: backendUrl(`/automations/${encodeURIComponent(id)}`),
      withBody: true,
    });
  } catch (error) {
    console.error('PUT /api/automations/:id error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/automations/:id/execute', async (req, res) => {
  try {
    const id = String(req.params?.id || '').trim();
    if (!id) return res.status(400).json({ message: 'Validation error.', missing: ['id'] });

    return await proxyJson(req, res, {
      method: 'POST',
      url: backendUrl(`/automations/${encodeURIComponent(id)}/execute`),
      withBody: true,
    });
  } catch (error) {
    console.error('POST /api/automations/:id/execute error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/automations/:id/executions', async (req, res) => {
  try {
    const id = String(req.params?.id || '').trim();
    if (!id) return res.status(400).json({ message: 'Validation error.', missing: ['id'] });

    return await proxyJson(req, res, {
      method: 'GET',
      url: withQuery(backendUrl(`/automations/${encodeURIComponent(id)}/executions`), req.query),
    });
  } catch (error) {
    console.error('GET /api/automations/:id/executions error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
