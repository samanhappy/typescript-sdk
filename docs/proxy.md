# HTTP/HTTPS Proxy Configuration

This guide explains how to configure HTTP and HTTPS proxies when using the MCP TypeScript SDK to connect to MCP servers.

## Overview

The MCP SDK supports HTTP/HTTPS proxy configuration for client transports. This is useful when:

- Your network requires requests to go through a corporate proxy
- You want to inspect or debug network traffic
- You need to route traffic through a specific gateway

## Prerequisites

Proxy support requires the `undici` package:

```bash
npm install undici
```

## Basic Usage

### Using Environment Variables

The simplest approach is to use standard proxy environment variables:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { createFetchWithProxy, getProxyConfigFromEnv } from '@modelcontextprotocol/sdk/client/proxy';

// Create transport with proxy from environment variables
const transport = new StreamableHTTPClientTransport(
  new URL('https://mcp-server.example.com'),
  {
    fetch: createFetchWithProxy(getProxyConfigFromEnv())
  }
);

const client = new Client({ name: 'my-client', version: '1.0.0' });
await client.connect(transport);
```

Then run your application with environment variables:

```bash
HTTP_PROXY=http://proxy.example.com:8080 \
HTTPS_PROXY=https://proxy.example.com:8443 \
NO_PROXY=localhost,127.0.0.1 \
node your-app.js
```

### Direct Configuration

You can also configure proxies directly in code:

```typescript
import { createFetchWithProxy } from '@modelcontextprotocol/sdk/client/proxy';

const transport = new StreamableHTTPClientTransport(
  new URL('https://mcp-server.example.com'),
  {
    fetch: createFetchWithProxy({
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'https://proxy.example.com:8443',
      noProxy: 'localhost,127.0.0.1,.internal'
    })
  }
);
```

## Proxy Authentication

Proxies that require authentication can include credentials in the URL:

```typescript
const transport = new StreamableHTTPClientTransport(
  new URL('https://mcp-server.example.com'),
  {
    fetch: createFetchWithProxy({
      httpProxy: 'http://username:password@proxy.example.com:8080',
      httpsProxy: 'https://username:password@proxy.example.com:8443'
    })
  }
);
```

Or via environment variables:

```bash
HTTP_PROXY=http://username:password@proxy.example.com:8080
HTTPS_PROXY=https://username:password@proxy.example.com:8443
```

## NO_PROXY Configuration

The `NO_PROXY` setting (or `noProxy` option) specifies hosts that should bypass the proxy:

```typescript
const transport = new StreamableHTTPClientTransport(
  new URL('https://mcp-server.example.com'),
  {
    fetch: createFetchWithProxy({
      httpProxy: 'http://proxy.example.com:8080',
      noProxy: 'localhost,127.0.0.1,.local,.internal'
    })
  }
);
```

Supported patterns in `NO_PROXY`:
- Exact hostname: `example.com`
- Domain suffix: `.example.com` (matches `sub.example.com`)
- IP address: `127.0.0.1`
- Wildcard: `*` (bypasses proxy for all hosts)

Multiple patterns are separated by commas.

## Using with SSE Transport

Proxy configuration works with both `StreamableHTTPClientTransport` and `SSEClientTransport`:

```typescript
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
import { createFetchWithProxy, getProxyConfigFromEnv } from '@modelcontextprotocol/sdk/client/proxy';

const transport = new SSEClientTransport(
  new URL('https://mcp-server.example.com'),
  {
    fetch: createFetchWithProxy(getProxyConfigFromEnv())
  }
);
```

## Environment Variables

The SDK recognizes these standard proxy environment variables (lowercase takes precedence):

- `HTTP_PROXY` / `http_proxy` - Proxy for HTTP requests
- `HTTPS_PROXY` / `https_proxy` - Proxy for HTTPS requests
- `NO_PROXY` / `no_proxy` - Comma-separated list of hosts to bypass

## Complete Example

See [`src/examples/client/proxyClient.ts`](../src/examples/client/proxyClient.ts) for a complete runnable example.

## Troubleshooting

### "Proxy support requires the undici package"

Install undici:

```bash
npm install undici
```

### Proxy not working

1. Verify proxy URL is correct (including protocol `http://` or `https://`)
2. Check if proxy requires authentication
3. Ensure the target server is not in your `NO_PROXY` list
4. Test proxy with a simple HTTP client first:

```typescript
const response = await fetch('https://example.com', {
  // @ts-expect-error - dispatcher is undici-specific
  dispatcher: new ProxyAgent('http://proxy.example.com:8080')
});
```

### SSL/TLS errors with HTTPS proxy

If you encounter certificate errors with HTTPS proxies, you may need to configure your proxy's CA certificate. This is proxy-specific and depends on your proxy server configuration.

## API Reference

### `createFetchWithProxy(config: ProxyConfig): FetchLike`

Creates a fetch function configured to use the specified proxy settings.

**Parameters:**
- `config.httpProxy` - HTTP proxy URL (optional)
- `config.httpsProxy` - HTTPS proxy URL (optional)
- `config.noProxy` - Comma-separated list of hosts to bypass (optional)

**Returns:** A fetch-compatible function that routes requests through the proxy

### `getProxyConfigFromEnv(): ProxyConfig`

Reads proxy configuration from standard environment variables.

**Returns:** A `ProxyConfig` object with values from environment variables

### `ProxyConfig` Interface

```typescript
interface ProxyConfig {
  httpProxy?: string;
  httpsProxy?: string;
  noProxy?: string;
}
```
