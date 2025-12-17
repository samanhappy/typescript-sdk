# Authorization Headers Support Analysis Summary

## Question (问题)
分析代码实现，是否支持在调用工具时传递一些特殊的请求头比如 authorization，生成一份说明文档

(Analyze the code implementation to determine if it supports passing special request headers like authorization when calling tools, and generate documentation)

## Answer (答案)

**是的，MCP TypeScript SDK 完全支持在调用工具时传递授权（Authorization）等特殊请求头。**

**Yes, the MCP TypeScript SDK fully supports passing authorization and other special request headers when calling tools.**

## Supported Methods (支持的方式)

### 1. OAuth Authentication (推荐/Recommended) ✅

SDK 内置完整的 OAuth 2.0 客户端支持，自动处理令牌获取、刷新和请求头添加。

The SDK has built-in OAuth 2.0 client support with automatic token acquisition, refresh, and header addition.

**Transports:** StreamableHTTP, SSE

**Example:**
```typescript
import { ClientCredentialsProvider } from '@modelcontextprotocol/sdk/client/auth-extensions';

const authProvider = new ClientCredentialsProvider({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  tokenUrl: 'https://auth.example.com/oauth/token'
});

const transport = new StreamableHTTPClientTransport(url, { authProvider });
```

### 2. RequestInit Headers (简单场景/Simple Scenarios) ✅

通过 `requestInit.headers` 配置静态请求头。

Configure static headers via `requestInit.headers`.

**Transports:** StreamableHTTP, SSE

**Example:**
```typescript
const transport = new StreamableHTTPClientTransport(url, {
  requestInit: {
    headers: {
      'Authorization': 'Bearer your-token',
      'X-API-Key': 'your-api-key'
    }
  }
});
```

### 3. Middleware (高级场景/Advanced Scenarios) ✅

使用中间件动态添加和修改请求头。

Use middleware to dynamically add and modify headers.

**Transports:** StreamableHTTP, SSE

**Example:**
```typescript
import { createMiddleware } from '@modelcontextprotocol/sdk/client/middleware';

const authMiddleware = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  const token = await getToken();
  headers.set('Authorization', `Bearer ${token}`);
  return next(input, { ...init, headers });
});

const transport = new StreamableHTTPClientTransport(url, {
  fetch: authMiddleware(fetch)
});
```

## Transport Support Matrix (传输支持矩阵)

| Transport | OAuth | RequestInit Headers | Middleware | Notes |
|-----------|-------|-------------------|-----------|-------|
| **StreamableHTTP** | ✅ | ✅ | ✅ | Recommended for remote servers |
| **SSE** | ✅ | ✅ | ✅ | Deprecated, backward compatibility only |
| **stdio** | ❌ | ❌ | ❌ | Use environment variables instead |

## Key Files Analyzed (分析的关键文件)

1. **Transport Implementations:**
   - `src/client/streamableHttp.ts` - StreamableHTTP transport with full header support
   - `src/client/sse.ts` - SSE transport with header support
   - `src/client/stdio.ts` - stdio transport (no HTTP headers)

2. **Authentication:**
   - `src/client/auth.ts` - Core OAuth implementation
   - `src/client/auth-extensions.ts` - OAuth client providers (ClientCredentials, PrivateKeyJWT)

3. **Middleware:**
   - `src/client/middleware.ts` - Middleware system (withOAuth, withLogging, createMiddleware)

4. **Protocol Layer:**
   - `src/shared/protocol.ts` - Request/response handling
   - `src/shared/transport.ts` - Transport interface and utilities

## Documentation Created (创建的文档)

### English Version
**File:** `docs/authorization-headers.md`

**Sections:**
- Overview of authorization header support
- Three main approaches (OAuth, RequestInit, Middleware)
- Transport-specific implementation details
- Practical examples (static API keys, dynamic JWT, combined auth)
- Security considerations
- Debugging tips
- Transport selection recommendations

### Chinese Version (中文版)
**File:** `docs/authorization-headers.zh-CN.md`

**章节:**
- 授权请求头支持概述
- 三种主要方式（OAuth、RequestInit、中间件）
- 不同传输层的具体实现
- 实际应用示例（静态 API 密钥、动态 JWT、组合认证）
- 安全注意事项
- 调试技巧
- 传输选择建议

## Code Examples in Documentation (文档中的代码示例)

The documentation includes comprehensive examples for:

1. **OAuth Authentication:**
   - Client Credentials flow
   - Private Key JWT authentication
   - Automatic token refresh

2. **Static Headers:**
   - API keys
   - Bearer tokens
   - Custom headers

3. **Dynamic Middleware:**
   - Token caching and refresh
   - Conditional authentication
   - Multiple middleware composition
   - Request signing

4. **Real-world Scenarios:**
   - Combining multiple auth methods
   - Different auth for different endpoints
   - Logging and debugging

## Header Merge Priority (请求头合并优先级)

When multiple sources provide headers, they are merged in this order:

1. SDK internal headers (highest priority)
   - `mcp-session-id`
   - `mcp-protocol-version`
2. OAuth Authorization header (if authProvider configured)
3. requestInit.headers
4. Middleware-added headers (lowest priority, overrides previous)

## Security Best Practices (安全最佳实践)

1. ✅ Use environment variables for sensitive data
2. ✅ Use OAuth for production environments
3. ✅ Always use HTTPS transports
4. ✅ Implement token refresh logic
5. ❌ Never hardcode credentials in code
6. ❌ Avoid HTTP in production

## Related Examples (相关示例)

The SDK includes working examples demonstrating authorization:

- `src/examples/client/simpleOAuthClient.ts`
- `src/examples/client/simpleOAuthClientProvider.ts`
- `src/examples/client/simpleClientCredentials.ts`
- `src/examples/server/demoInMemoryOAuthProvider.ts`

## Conclusion (结论)

The MCP TypeScript SDK provides **comprehensive and flexible support** for passing authorization headers when calling tools:

✅ **Full OAuth 2.0 support** with automatic token management
✅ **Simple static header configuration** for basic scenarios
✅ **Powerful middleware system** for complex authentication logic
✅ **Works with all HTTP transports** (StreamableHTTP and SSE)
✅ **Well-documented** with practical examples

The documentation has been added to:
- `docs/authorization-headers.md` (English)
- `docs/authorization-headers.zh-CN.md` (Chinese)
- README.md (updated with links)

Both versions provide detailed guidance on:
- How to use each approach
- Transport-specific considerations
- Security best practices
- Real-world examples
- Debugging and troubleshooting
