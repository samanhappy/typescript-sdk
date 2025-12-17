# MCP SDK Authorization Headers Guide

This document provides a comprehensive guide on how to pass authorization and other special request headers when calling tools with the MCP TypeScript SDK.

## Table of Contents

- [Overview](#overview)
- [Supported Approaches](#supported-approaches)
  - [1. Using OAuth Authentication (Recommended)](#1-using-oauth-authentication-recommended)
  - [2. Using RequestInit Custom Headers](#2-using-requestinit-custom-headers)
  - [3. Using Middleware to Add Headers](#3-using-middleware-to-add-headers)
- [Transport-Specific Implementation](#transport-specific-implementation)
  - [StreamableHTTP Transport](#streamablehttp-transport)
  - [SSE Transport](#sse-transport)
  - [stdio Transport](#stdio-transport)
- [Practical Examples](#practical-examples)
- [Important Considerations](#important-considerations)

## Overview

The MCP SDK supports passing authorization headers when calling tools through several mechanisms:

1. **OAuth Authentication** - Built-in OAuth 2.0 support (recommended approach)
2. **Transport RequestInit** - Configure custom headers at the transport layer
3. **Middleware** - Use fetch middleware to dynamically add headers

## Supported Approaches

### 1. Using OAuth Authentication (Recommended)

This is the **recommended standard approach** for StreamableHTTP and SSE transports. The SDK provides complete OAuth 2.0 client implementation.

#### Client Credentials Flow

```typescript
import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { ClientCredentialsProvider } from '@modelcontextprotocol/sdk/client/auth-extensions';

// Create OAuth provider
const authProvider = new ClientCredentialsProvider({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  tokenUrl: 'https://auth.example.com/oauth/token',
  scope: 'mcp:read mcp:write'
});

// Create transport with OAuth
const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  {
    authProvider: authProvider,  // OAuth provider automatically adds Authorization header
    requestInit: {
      // Optional: add other custom headers
      headers: {
        'X-Custom-Header': 'custom-value'
      }
    }
  }
);

// Create client and connect
const client = new Client({ name: 'my-client', version: '1.0.0' });
await client.connect(transport);

// Call tool - Authorization header is automatically included
const result = await client.callTool({
  name: 'my-tool',
  arguments: { param: 'value' }
});
```

#### Private Key JWT Authentication

```typescript
import { PrivateKeyJwtProvider } from '@modelcontextprotocol/sdk/client/auth-extensions';

// Use private key JWT for authentication
const authProvider = new PrivateKeyJwtProvider({
  clientId: 'your-client-id',
  privateKey: privateKeyPem,  // PEM format private key
  tokenUrl: 'https://auth.example.com/oauth/token',
  scope: 'mcp:read mcp:write'
});

const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  { authProvider }
);
```

**How OAuth Works:**
1. SDK automatically acquires and refreshes access tokens
2. Automatically adds `Authorization: Bearer <access_token>` header to every request
3. Handles 401 responses and automatically re-authenticates
4. Supports token refresh and scope elevation

Reference examples:
- [`simpleOAuthClient.ts`](../src/examples/client/simpleOAuthClient.ts)
- [`simpleOAuthClientProvider.ts`](../src/examples/client/simpleOAuthClientProvider.ts)
- [`simpleClientCredentials.ts`](../src/examples/client/simpleClientCredentials.ts)

### 2. Using RequestInit Custom Headers

For HTTP transports (StreamableHTTP and SSE), you can configure custom headers via the `requestInit` parameter when creating the transport.

#### StreamableHTTP Example

```typescript
import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';

// Create transport with custom headers
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

// All requests will include configured headers
const result = await client.callTool({
  name: 'my-tool',
  arguments: { param: 'value' }
});
```

**How it Works:**
- Headers in `requestInit.headers` are added to all HTTP requests
- Supports both POST (sending requests) and GET (SSE stream) requests
- Headers are merged with SDK internal headers (like `mcp-session-id`, `mcp-protocol-version`)

#### SSE Transport Example

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

### 3. Using Middleware to Add Headers

The SDK provides a powerful middleware system that allows dynamic header addition and modification. This is suitable for scenarios requiring dynamic token generation or complex authentication logic.

#### Basic Middleware Example

```typescript
import { createMiddleware } from '@modelcontextprotocol/sdk/client/middleware';

// Create custom auth middleware
const authMiddleware = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  
  // Dynamically get token (e.g., from local storage)
  const token = await getTokenFromStorage();
  headers.set('Authorization', `Bearer ${token}`);
  
  // Add other custom headers
  headers.set('X-Request-ID', generateRequestId());
  headers.set('X-Client-Version', '1.0.0');
  
  return next(input, { ...init, headers });
});

// Apply middleware to fetch
const enhancedFetch = authMiddleware(fetch);

// Use enhanced fetch in transport
const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  {
    fetch: enhancedFetch
  }
);
```

#### Combining Multiple Middleware

```typescript
import { 
  withOAuth, 
  withLogging, 
  applyMiddlewares,
  createMiddleware 
} from '@modelcontextprotocol/sdk/client/middleware';

// Custom headers middleware
const customHeadersMiddleware = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  headers.set('X-API-Version', 'v2');
  headers.set('X-Client-ID', 'my-client');
  return next(input, { ...init, headers });
});

// Combine multiple middleware: OAuth + custom headers + logging
const enhancedFetch = applyMiddlewares(
  withOAuth(oauthProvider, 'https://api.example.com'),
  customHeadersMiddleware,
  withLogging({ statusLevel: 400 })  // Only log errors
)(fetch);

const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  { fetch: enhancedFetch }
);
```

#### Conditional Header Addition

```typescript
const conditionalAuthMiddleware = createMiddleware(async (next, input, init) => {
  const url = typeof input === 'string' ? input : input.toString();
  const headers = new Headers(init?.headers);
  
  // Decide whether to add auth header based on URL
  if (url.includes('/protected/')) {
    const token = await getSecureToken();
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.set('X-Public-Access', 'true');
  }
  
  return next(input, { ...init, headers });
});
```

## Transport-Specific Implementation

### StreamableHTTP Transport

StreamableHTTP is the **recommended transport for remote servers** and fully supports all authorization approaches.

**Features:**
- ✅ Supports OAuth authentication (`authProvider`)
- ✅ Supports custom headers (`requestInit.headers`)
- ✅ Supports custom fetch (`fetch` parameter)
- ✅ Supports middleware
- ✅ Automatic session ID handling (`mcp-session-id`)
- ✅ Automatic protocol version handling (`mcp-protocol-version`)

**Complete Example:**

```typescript
import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { ClientCredentialsProvider } from '@modelcontextprotocol/sdk/client/auth-extensions';
import { withLogging } from '@modelcontextprotocol/sdk/client/middleware';

// Configure OAuth
const authProvider = new ClientCredentialsProvider({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tokenUrl: 'https://auth.example.com/token'
});

// Configure fetch with logging
const fetchWithLogging = withLogging({
  statusLevel: 0,  // Log all requests
  includeRequestHeaders: true,
  includeResponseHeaders: true
})(fetch);

// Create transport
const transport = new StreamableHTTPClientTransport(
  new URL('https://api.example.com/mcp'),
  {
    authProvider,           // OAuth automatically adds Authorization header
    fetch: fetchWithLogging,  // Fetch with logging
    requestInit: {
      headers: {
        'X-API-Key': 'api-key',
        'X-App-Version': '1.0.0'
      }
    }
  }
);

// Create and connect client
const client = new Client(
  { name: 'my-client', version: '1.0.0' },
  { capabilities: {} }
);
await client.connect(transport);

// Call tool - all configured headers are automatically included
const result = await client.callTool({
  name: 'example-tool',
  arguments: { input: 'test' }
});
```

**Header Merge Priority:**
1. SDK internal headers (`mcp-session-id`, `mcp-protocol-version`)
2. OAuth Authorization header (if `authProvider` is configured)
3. Custom headers in `requestInit.headers`
4. Headers added by middleware (applied last)

### SSE Transport

SSE (Server-Sent Events) transport is the legacy HTTP+SSE transport, deprecated but still supported.

**Features:**
- ✅ Supports OAuth authentication
- ✅ Supports custom headers
- ✅ Supports custom fetch
- ⚠️ Deprecated, use StreamableHTTP instead

**Example:**

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

### stdio Transport

The stdio transport is used for local process communication and **does not support HTTP headers** because it uses standard input/output streams rather than HTTP.

**Features:**
- ❌ Does not support HTTP headers
- ❌ Does not support OAuth
- ✅ Used for locally spawned process integration

**Alternatives:**
If you need to pass authentication information with stdio transport, you can:
1. Use environment variables
2. Pass authentication tokens in tool arguments
3. Use configuration files

```typescript
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';

// stdio doesn't support headers, but you can pass auth via environment variables
const transport = new StdioClientTransport({
  command: 'node',
  args: ['server.js'],
  env: {
    ...process.env,
    AUTH_TOKEN: 'your-token',  // Pass via environment variable
    API_KEY: 'your-api-key'
  }
});
```

## Practical Examples

### Scenario 1: Using Static API Key

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

### Scenario 2: Dynamically Refreshing JWT Token

```typescript
import { createMiddleware } from '@modelcontextprotocol/sdk/client/middleware';

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

const dynamicJwtMiddleware = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  
  // Check if token is expired
  if (!cachedToken || Date.now() >= tokenExpiry) {
    // Get new token
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

### Scenario 3: Combining Multiple Authentication Methods

```typescript
import { createMiddleware, applyMiddlewares } from '@modelcontextprotocol/sdk/client/middleware';

// API key middleware
const apiKeyMiddleware = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  headers.set('X-API-Key', process.env.API_KEY!);
  return next(input, { ...init, headers });
});

// JWT middleware
const jwtMiddleware = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  const token = await getJwtToken();
  headers.set('Authorization', `Bearer ${token}`);
  return next(input, { ...init, headers });
});

// Signature middleware
const signatureMiddleware = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  const timestamp = Date.now().toString();
  const signature = generateSignature(timestamp, process.env.SECRET!);
  headers.set('X-Timestamp', timestamp);
  headers.set('X-Signature', signature);
  return next(input, { ...init, headers });
});

// Combine all middleware
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

### Scenario 4: Conditional Authentication

```typescript
const conditionalAuthMiddleware = createMiddleware(async (next, input, init) => {
  const url = typeof input === 'string' ? input : input.toString();
  const headers = new Headers(init?.headers);
  
  // Choose authentication method based on endpoint
  if (url.includes('/admin/')) {
    // Admin endpoint uses strong authentication
    const adminToken = await getAdminToken();
    headers.set('Authorization', `Bearer ${adminToken}`);
    headers.set('X-Admin-Role', 'super-admin');
  } else if (url.includes('/api/')) {
    // API endpoint uses API key
    headers.set('X-API-Key', process.env.API_KEY!);
  } else {
    // Public endpoint uses basic authentication
    headers.set('X-Public-Access', 'true');
  }
  
  return next(input, { ...init, headers });
});
```

## Important Considerations

### Security

1. **Never hardcode sensitive information in code**
   ```typescript
   // ❌ Wrong - hardcoded token
   headers: { 'Authorization': 'Bearer hardcoded-token' }
   
   // ✅ Correct - use environment variables
   headers: { 'Authorization': `Bearer ${process.env.AUTH_TOKEN}` }
   ```

2. **Use OAuth instead of static tokens**
   - OAuth supports token refresh
   - Automatic expiration handling
   - More secure credential management

3. **HTTPS Transport**
   ```typescript
   // ✅ Use HTTPS
   new URL('https://api.example.com/mcp')
   
   // ❌ Avoid HTTP in production
   new URL('http://api.example.com/mcp')
   ```

### Header Merging

Headers are merged in the following order (later ones override earlier ones):

1. SDK internal headers
2. OAuth Authorization header (if `authProvider` is present)
3. `requestInit.headers`
4. Headers modified by middleware

```typescript
// Example: Final headers
{
  // 1. SDK internal (highest priority)
  'mcp-session-id': 'session-123',
  'mcp-protocol-version': '2024-11-05',
  
  // 2. OAuth
  'Authorization': 'Bearer oauth-token',
  
  // 3. requestInit
  'X-API-Key': 'api-key',
  
  // 4. Middleware (lowest priority, overrides previous)
  'X-Custom': 'value'
}
```

### Debugging

Use logging middleware to see actual request headers:

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

### Transport Selection Recommendations

| Scenario | Recommended Transport | Authentication Method |
|----------|---------------------|----------------------|
| Remote API server | StreamableHTTP | OAuth or API key |
| Need server push notifications | StreamableHTTP | OAuth |
| Legacy system compatibility | SSE | OAuth or custom headers |
| Local process integration | stdio | Environment variables |
| Inter-microservice communication | StreamableHTTP | OAuth (client_credentials) |
| Development/test environment | StreamableHTTP | Static token (requestInit) |

## Related Resources

### SDK Documentation
- [Client Documentation](./client.md)
- [Server Documentation](./server.md)
- [Capabilities Documentation](./capabilities.md)

### Example Code
- OAuth client examples:
  - [`simpleOAuthClient.ts`](../src/examples/client/simpleOAuthClient.ts)
  - [`simpleOAuthClientProvider.ts`](../src/examples/client/simpleOAuthClientProvider.ts)
  - [`simpleClientCredentials.ts`](../src/examples/client/simpleClientCredentials.ts)
- Basic client examples:
  - [`simpleStreamableHttp.ts`](../src/examples/client/simpleStreamableHttp.ts)
  - [`streamableHttpWithSseFallbackClient.ts`](../src/examples/client/streamableHttpWithSseFallbackClient.ts)

### Source Code
- Transport implementations:
  - [`src/client/streamableHttp.ts`](../src/client/streamableHttp.ts)
  - [`src/client/sse.ts`](../src/client/sse.ts)
  - [`src/client/stdio.ts`](../src/client/stdio.ts)
- Middleware: [`src/client/middleware.ts`](../src/client/middleware.ts)
- OAuth authentication:
  - [`src/client/auth.ts`](../src/client/auth.ts)
  - [`src/client/auth-extensions.ts`](../src/client/auth-extensions.ts)

### External References
- [MCP Specification](https://spec.modelcontextprotocol.io)
- [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749)

---

## Summary

The MCP TypeScript SDK provides flexible and powerful ways to pass authorization headers:

1. **Recommended approach**: Use built-in OAuth support with automatic token management
2. **Simple scenarios**: Use `requestInit.headers` to configure static headers
3. **Advanced scenarios**: Use middleware for dynamic and complex authentication logic

Choose the appropriate approach based on your specific needs:
- Production environments: use OAuth
- Development/test environments: use static configuration
- Complex authentication logic: use middleware

All HTTP transports (StreamableHTTP and SSE) fully support authorization header passing, while stdio transport requires alternatives (such as environment variables).
