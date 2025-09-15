/**
 * 尝试探测签名服务健康状态。
 * 会按顺序探测多个常见健康接口路径，返回第一个成功结果。
 *
 * @param {string} serverBase 基础服务地址，如 https://example.com
 * @param {string} [authToken] 可选的 Bearer Token
 * @returns {Promise<{ok: boolean, endpoint?: string, status?: number, body?: any, error?: string}>}
 */
export async function signatureHealthCheck(serverBase, authToken) {
  const result = { ok: false };
  try {
    const base = String(serverBase || '').replace(/\/$/, '');
    if (!base) {
      return { ok: false, error: 'serverBase 为空' };
    }
    const candidates = [
      '/api/v1/xfyun/sign/tts',
      '/api/v1/xfyun/sign/rtasr',
      '/api/v1/xfyun/sign/iat',
      '/api/v1/xfyun/sign/dts/create',
      '/api/v1/xfyun/sign/dts/query'
    ];
    const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
    for (const path of candidates) {
      const url = base + path;
      try {
        const resp = await fetch(url, { method: 'GET', headers });
        const contentType = resp.headers.get('content-type') || '';
        let body;
        if (contentType.includes('application/json')) {
          try { body = await resp.json(); } catch (_) { body = await resp.text(); }
        } else {
          body = await resp.text();
        }
        if (resp.ok) {
          return { ok: true, endpoint: url, status: resp.status, body };
        } else {
          // 记录最后一次非 2xx 响应
          result.endpoint = url;
          result.status = resp.status;
          result.body = body;
        }
      } catch (e) {
        // 忽略，尝试下一个候选
        result.error = String(e && e.message || e);
      }
    }
    return result;
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

/**
 * 检查特定服务的健康状态
 * @param {string} serverBase 基础服务地址
 * @param {string} serviceType 服务类型：'iat', 'tts', 'rtasr', 'dts-create', 'dts-query'
 * @param {string} [authToken] 可选的 Bearer Token
 * @returns {Promise<{ok: boolean, endpoint?: string, status?: number, body?: any, error?: string}>}
 */
export async function checkServiceHealth(serverBase, serviceType, authToken) {
  const result = { ok: false };
  try {
    const base = String(serverBase || '').replace(/\/$/, '');
    if (!base) {
      return { ok: false, error: 'serverBase 为空' };
    }

    const serviceEndpoints = {
      'iat': '/api/v1/xfyun/sign/iat',
      'tts': '/api/v1/xfyun/sign/tts',
      'rtasr': '/api/v1/xfyun/sign/rtasr',
      'dts-create': '/api/v1/xfyun/sign/dts/create',
      'dts-query': '/api/v1/xfyun/sign/dts/query'
    };

    const endpoint = serviceEndpoints[serviceType];
    if (!endpoint) {
      return { ok: false, error: `不支持的服务类型: ${serviceType}` };
    }

    const url = base + endpoint;
    const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
    
    try {
      const resp = await fetch(url, { method: 'GET', headers });
      const contentType = resp.headers.get('content-type') || '';
      let body;
      if (contentType.includes('application/json')) {
        try { body = await resp.json(); } catch (_) { body = await resp.text(); }
      } else {
        body = await resp.text();
      }
      
      if (resp.ok) {
        return { ok: true, endpoint: url, status: resp.status, body };
      } else {
        return { 
          ok: false, 
          endpoint: url, 
          status: resp.status, 
          body, 
          error: `HTTP ${resp.status}: ${resp.statusText}` 
        };
      }
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}



