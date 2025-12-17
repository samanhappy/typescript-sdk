# MCP SDK 授权请求头传递指南

本文档详细说明了在使用 MCP TypeScript SDK 调用工具时如何传递授权（Authorization）等特殊请求头。

## 目录

- [概述](#概述)
- [支持的方式](#支持的方式)
  - [1. 使用 OAuth 认证（推荐）](#1-使用-oauth-认证推荐)
  - [2. 使用 RequestInit 自定义请求头](#2-使用-requestinit-自定义请求头)
  - [3. 使用中间件添加请求头](#3-使用中间件添加请求头)
- [不同传输层的实现](#不同传输层的实现)
  - [StreamableHTTP 传输](#streamablehttp-传输)
  - [SSE 传输](#sse-传输)
  - [stdio 传输](#stdio-传输)
- [实际应用示例](#实际应用示例)
- [注意事项](#注意事项)

## 概述

MCP SDK 支持在调用工具时传递授权请求头，主要通过以下机制：

1. **OAuth 认证** - SDK 内置的 OAuth 2.0 支持（推荐方式）
2. **Transport RequestInit** - 在传输层配置自定义请求头
3. **中间件** - 使用 fetch 中间件动态添加请求头

## 支持的方式

### 1. 使用 OAuth 认证（推荐）

这是 SDK **推荐的标准方式**，适用于 StreamableHTTP 和 SSE 传输。SDK 提供完整的 OAuth 2.0 客户端实现。

#### 客户端凭证流（Client Credentials）

```typescript
import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { ClientCredentialsProvider } from '@modelcontextprotocol/sdk/client/auth-extensions';

// 创建 OAuth 提供者
const authProvider = new ClientCredentialsProvider({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  tokenUrl: 'https://auth.example.com/oauth/token',
  scope: 'mcp:read mcp:write'
});

// 创建带 OAuth 的传输
const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  {
    authProvider: authProvider,  // OAuth 提供者会自动添加 Authorization 头
    requestInit: {
      // 可选：添加其他自定义请求头
      headers: {
        'X-Custom-Header': 'custom-value'
      }
    }
  }
);

// 创建客户端并连接
const client = new Client({ name: 'my-client', version: '1.0.0' });
await client.connect(transport);

// 调用工具 - Authorization 头会自动添加
const result = await client.callTool({
  name: 'my-tool',
  arguments: { param: 'value' }
});
```

#### 私钥 JWT 认证（Private Key JWT）

```typescript
import { PrivateKeyJwtProvider } from '@modelcontextprotocol/sdk/client/auth-extensions';

// 使用私钥 JWT 进行认证
const authProvider = new PrivateKeyJwtProvider({
  clientId: 'your-client-id',
  privateKey: privateKeyPem,  // PEM 格式的私钥
  tokenUrl: 'https://auth.example.com/oauth/token',
  scope: 'mcp:read mcp:write'
});

const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  { authProvider }
);
```

**OAuth 的工作原理：**
1. SDK 自动获取和刷新访问令牌
2. 在每个请求中自动添加 `Authorization: Bearer <access_token>` 头
3. 处理 401 响应并自动重新认证
4. 支持令牌刷新和作用域提升

参考示例：
- [`simpleOAuthClient.ts`](../src/examples/client/simpleOAuthClient.ts)
- [`simpleOAuthClientProvider.ts`](../src/examples/client/simpleOAuthClientProvider.ts)
- [`simpleClientCredentials.ts`](../src/examples/client/simpleClientCredentials.ts)

### 2. 使用 RequestInit 自定义请求头

对于 HTTP 传输（StreamableHTTP 和 SSE），可以在创建传输时通过 `requestInit` 参数配置自定义请求头。

#### StreamableHTTP 示例

```typescript
import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';

// 创建带自定义请求头的传输
const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  {
    requestInit: {
      headers: {
        'Authorization': 'Bearer your-static-token',
        'X-API-Key': 'your-api-key',
        'X-Custom-Header': 'custom-value'
      }
    }
  }
);

const client = new Client({ name: 'my-client', version: '1.0.0' });
await client.connect(transport);

// 所有请求都会包含配置的请求头
const result = await client.callTool({
  name: 'my-tool',
  arguments: { param: 'value' }
});
```

**工作原理：**
- `requestInit.headers` 中的请求头会被添加到所有 HTTP 请求中
- 支持 POST（发送请求）和 GET（SSE 流）请求
- 请求头会与 SDK 内部请求头合并（如 `mcp-session-id`、`mcp-protocol-version`）

#### SSE 传输示例

```typescript
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';

const transport = new SSEClientTransport(
  new URL('https://api.example.com/sse'),
  {
    requestInit: {
      headers: {
        'Authorization': 'Bearer your-token',
        'X-Custom-Header': 'value'
      }
    }
  }
);
```

### 3. 使用中间件添加请求头

SDK 提供了强大的中间件系统，允许动态添加、修改请求头。适用于需要动态生成令牌或复杂认证逻辑的场景。

#### 基本中间件示例

```typescript
import { createMiddleware } from '@modelcontextprotocol/sdk/client/middleware';

// 创建自定义认证中间件
const authMiddleware = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  
  // 动态获取令牌（例如从本地存储）
  const token = await getTokenFromStorage();
  headers.set('Authorization', `Bearer ${token}`);
  
  // 添加其他自定义请求头
  headers.set('X-Request-ID', generateRequestId());
  headers.set('X-Client-Version', '1.0.0');
  
  return next(input, { ...init, headers });
});

// 应用中间件到 fetch
const enhancedFetch = authMiddleware(fetch);

// 在传输中使用增强的 fetch
const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  {
    fetch: enhancedFetch
  }
);
```

#### 组合多个中间件

```typescript
import { 
  withOAuth, 
  withLogging, 
  applyMiddlewares,
  createMiddleware 
} from '@modelcontextprotocol/sdk/client/middleware';

// 自定义请求头中间件
const customHeadersMiddleware = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  headers.set('X-API-Version', 'v2');
  headers.set('X-Client-ID', 'my-client');
  return next(input, { ...init, headers });
});

// 组合多个中间件：OAuth + 自定义请求头 + 日志
const enhancedFetch = applyMiddlewares(
  withOAuth(oauthProvider, 'https://api.example.com'),
  customHeadersMiddleware,
  withLogging({ statusLevel: 400 })  // 只记录错误
)(fetch);

const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  { fetch: enhancedFetch }
);
```

#### 条件性添加请求头

```typescript
const conditionalAuthMiddleware = createMiddleware(async (next, input, init) => {
  const url = typeof input === 'string' ? input : input.toString();
  const headers = new Headers(init?.headers);
  
  // 根据 URL 决定是否添加认证头
  if (url.includes('/protected/')) {
    const token = await getSecureToken();
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.set('X-Public-Access', 'true');
  }
  
  return next(input, { ...init, headers });
});
```

## 不同传输层的实现

### StreamableHTTP 传输

StreamableHTTP 是**推荐的远程服务器传输方式**，完全支持所有授权方式。

**特点：**
- ✅ 支持 OAuth 认证（`authProvider`）
- ✅ 支持自定义请求头（`requestInit.headers`）
- ✅ 支持自定义 fetch（`fetch` 参数）
- ✅ 支持中间件
- ✅ 自动处理会话 ID（`mcp-session-id`）
- ✅ 自动处理协议版本（`mcp-protocol-version`）

**完整示例：**

```typescript
import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { ClientCredentialsProvider } from '@modelcontextprotocol/sdk/client/auth-extensions';
import { withLogging } from '@modelcontextprotocol/sdk/client/middleware';

// 配置 OAuth
const authProvider = new ClientCredentialsProvider({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tokenUrl: 'https://auth.example.com/token'
});

// 配置带日志的 fetch
const fetchWithLogging = withLogging({
  statusLevel: 0,  // 记录所有请求
  includeRequestHeaders: true,
  includeResponseHeaders: true
})(fetch);

// 创建传输
const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  {
    authProvider,           // OAuth 自动添加 Authorization 头
    fetch: fetchWithLogging,  // 带日志的 fetch
    requestInit: {
      headers: {
        'X-API-Key': 'api-key',
        'X-App-Version': '1.0.0'
      }
    }
  }
);

// 创建和连接客户端
const client = new Client(
  { name: 'my-client', version: '1.0.0' },
  { capabilities: {} }
);
await client.connect(transport);

// 调用工具 - 所有配置的请求头都会自动包含
const result = await client.callTool({
  name: 'example-tool',
  arguments: { input: 'test' }
});
```

**请求头合并优先级：**
1. SDK 内部请求头（`mcp-session-id`、`mcp-protocol-version`）
2. OAuth Authorization 头（如果配置了 `authProvider`）
3. `requestInit.headers` 中的自定义请求头
4. 中间件添加的请求头（最后应用）

### SSE 传输

SSE（Server-Sent Events）传输是遗留的 HTTP+SSE 传输方式，已弃用但仍受支持。

**特点：**
- ✅ 支持 OAuth 认证
- ✅ 支持自定义请求头
- ✅ 支持自定义 fetch
- ⚠️ 已弃用，建议使用 StreamableHTTP

**示例：**

```typescript
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
import { ClientCredentialsProvider } from '@modelcontextprotocol/sdk/client/auth-extensions';

const authProvider = new ClientCredentialsProvider({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tokenUrl: 'https://auth.example.com/token'
});

const transport = new SSEClientTransport(
  new URL('https://api.example.com/sse'),
  {
    authProvider,
    requestInit: {
      headers: {
        'X-Custom-Header': 'value'
      }
    }
  }
);
```

### stdio 传输

stdio 传输用于本地进程通信，**不支持 HTTP 请求头**，因为它使用标准输入/输出流而非 HTTP。

**特点：**
- ❌ 不支持 HTTP 请求头
- ❌ 不支持 OAuth
- ✅ 用于本地进程派生的集成

**替代方案：**
如果需要在 stdio 传输中传递认证信息，可以：
1. 使用环境变量
2. 在工具参数中传递认证令牌
3. 使用配置文件

```typescript
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';

// stdio 不支持请求头，但可以通过环境变量传递认证信息
const transport = new StdioClientTransport({
  command: 'node',
  args: ['server.js'],
  env: {
    ...process.env,
    AUTH_TOKEN: 'your-token',  // 通过环境变量传递
    API_KEY: 'your-api-key'
  }
});
```

## 实际应用示例

### 场景 1：使用静态 API 密钥

```typescript
const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  {
    requestInit: {
      headers: {
        'X-API-Key': process.env.API_KEY,
        'Authorization': `Bearer ${process.env.STATIC_TOKEN}`
      }
    }
  }
);
```

### 场景 2：动态刷新的 JWT 令牌

```typescript
import { createMiddleware } from '@modelcontextprotocol/sdk/client/middleware';

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

const dynamicJwtMiddleware = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  
  // 检查令牌是否过期
  if (!cachedToken || Date.now() >= tokenExpiry) {
    // 获取新令牌
    const response = await fetch('https://auth.example.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: 'id', client_secret: 'secret' })
    });
    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);
  }
  
  headers.set('Authorization', `Bearer ${cachedToken}`);
  return next(input, { ...init, headers });
});

const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  { fetch: dynamicJwtMiddleware(fetch) }
);
```

### 场景 3：多种认证方式组合

```typescript
import { createMiddleware, applyMiddlewares } from '@modelcontextprotocol/sdk/client/middleware';

// API 密钥中间件
const apiKeyMiddleware = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  headers.set('X-API-Key', process.env.API_KEY!);
  return next(input, { ...init, headers });
});

// JWT 中间件
const jwtMiddleware = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  const token = await getJwtToken();
  headers.set('Authorization', `Bearer ${token}`);
  return next(input, { ...init, headers });
});

// 签名中间件
const signatureMiddleware = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  const timestamp = Date.now().toString();
  const signature = generateSignature(timestamp, process.env.SECRET!);
  headers.set('X-Timestamp', timestamp);
  headers.set('X-Signature', signature);
  return next(input, { ...init, headers });
});

// 组合所有中间件
const enhancedFetch = applyMiddlewares(
  apiKeyMiddleware,
  jwtMiddleware,
  signatureMiddleware
)(fetch);

const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  { fetch: enhancedFetch }
);
```

### 场景 4：条件性认证

```typescript
const conditionalAuthMiddleware = createMiddleware(async (next, input, init) => {
  const url = typeof input === 'string' ? input : input.toString();
  const headers = new Headers(init?.headers);
  
  // 根据端点选择认证方式
  if (url.includes('/admin/')) {
    // 管理员端点使用强认证
    const adminToken = await getAdminToken();
    headers.set('Authorization', `Bearer ${adminToken}`);
    headers.set('X-Admin-Role', 'super-admin');
  } else if (url.includes('/api/')) {
    // API 端点使用 API 密钥
    headers.set('X-API-Key', process.env.API_KEY!);
  } else {
    // 公共端点使用基本认证
    headers.set('X-Public-Access', 'true');
  }
  
  return next(input, { ...init, headers });
});
```

## 注意事项

### 安全性

1. **不要在代码中硬编码敏感信息**
   ```typescript
   // ❌ 错误 - 硬编码令牌
   headers: { 'Authorization': 'Bearer hardcoded-token' }
   
   // ✅ 正确 - 使用环境变量
   headers: { 'Authorization': `Bearer ${process.env.AUTH_TOKEN}` }
   ```

2. **使用 OAuth 而非静态令牌**
   - OAuth 支持令牌刷新
   - 自动处理过期
   - 更安全的凭证管理

3. **HTTPS 传输**
   ```typescript
   // ✅ 使用 HTTPS
   new URL('https://api.example.com/mcp')
   
   // ❌ 避免在生产环境使用 HTTP
   new URL('http://api.example.com/mcp')
   ```

### 请求头合并

请求头按以下顺序合并（后面的会覆盖前面的）：

1. SDK 内部请求头
2. OAuth Authorization 头（如果有 `authProvider`）
3. `requestInit.headers`
4. 中间件修改的请求头

```typescript
// 示例：最终请求头
{
  // 1. SDK 内部（优先级最高）
  'mcp-session-id': 'session-123',
  'mcp-protocol-version': '2024-11-05',
  
  // 2. OAuth
  'Authorization': 'Bearer oauth-token',
  
  // 3. requestInit
  'X-API-Key': 'api-key',
  
  // 4. 中间件（优先级最低，会覆盖前面的）
  'X-Custom': 'value'
}
```

### 调试

使用日志中间件查看实际发送的请求头：

```typescript
import { withLogging } from '@modelcontextprotocol/sdk/client/middleware';

const fetchWithLogging = withLogging({
  logger: (info) => {
    console.log(`[${info.method}] ${info.url}`);
    console.log('Status:', info.status);
    if (info.requestHeaders) {
      console.log('Request Headers:', 
        Object.fromEntries(info.requestHeaders.entries())
      );
    }
  },
  includeRequestHeaders: true,
  includeResponseHeaders: true,
  statusLevel: 0
})(fetch);
```

### 传输选择建议

| 场景 | 推荐传输 | 认证方式 |
|------|---------|---------|
| 远程 API 服务器 | StreamableHTTP | OAuth 或 API 密钥 |
| 需要服务器推送通知 | StreamableHTTP | OAuth |
| 遗留系统兼容 | SSE | OAuth 或自定义请求头 |
| 本地进程集成 | stdio | 环境变量 |
| 微服务间通信 | StreamableHTTP | OAuth (client_credentials) |
| 开发/测试环境 | StreamableHTTP | 静态令牌（requestInit） |

## 相关资源

### SDK 文档
- [客户端文档](./client.md)
- [服务器文档](./server.md)
- [功能文档](./capabilities.md)

### 示例代码
- OAuth 客户端示例：
  - [`simpleOAuthClient.ts`](../src/examples/client/simpleOAuthClient.ts)
  - [`simpleOAuthClientProvider.ts`](../src/examples/client/simpleOAuthClientProvider.ts)
  - [`simpleClientCredentials.ts`](../src/examples/client/simpleClientCredentials.ts)
- 基本客户端示例：
  - [`simpleStreamableHttp.ts`](../src/examples/client/simpleStreamableHttp.ts)
  - [`streamableHttpWithSseFallbackClient.ts`](../src/examples/client/streamableHttpWithSseFallbackClient.ts)

### 源代码
- 传输实现：
  - [`src/client/streamableHttp.ts`](../src/client/streamableHttp.ts)
  - [`src/client/sse.ts`](../src/client/sse.ts)
  - [`src/client/stdio.ts`](../src/client/stdio.ts)
- 中间件：[`src/client/middleware.ts`](../src/client/middleware.ts)
- OAuth 认证：
  - [`src/client/auth.ts`](../src/client/auth.ts)
  - [`src/client/auth-extensions.ts`](../src/client/auth-extensions.ts)

### 外部参考
- [MCP 规范](https://spec.modelcontextprotocol.io)
- [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749)

---

## 总结

MCP TypeScript SDK 提供了灵活且强大的方式来传递授权请求头：

1. **推荐方式**：使用内置的 OAuth 支持，自动处理令牌管理
2. **简单场景**：使用 `requestInit.headers` 配置静态请求头
3. **高级场景**：使用中间件实现动态和复杂的认证逻辑

选择合适的方式取决于您的具体需求：
- 生产环境推荐使用 OAuth
- 开发/测试环境可使用静态配置
- 复杂认证逻辑使用中间件

所有 HTTP 传输（StreamableHTTP 和 SSE）都完全支持授权请求头传递，而 stdio 传输需要使用替代方案（如环境变量）。
