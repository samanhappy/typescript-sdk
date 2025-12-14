# MCP SDK HTTP/HTTPS 代理配置指南

本文档详细说明如何在使用 MCP TypeScript SDK 连接 MCP 服务器时配置 HTTP 和 HTTPS 代理。

## 功能概述

MCP SDK 现在支持通过 HTTP/HTTPS 代理连接到 MCP 服务器。这在以下场景中非常有用：

- 企业网络环境需要通过代理访问外部服务
- 需要监控或调试网络流量
- 需要通过特定网关路由流量

## 前置条件

代理功能需要安装 `undici` 包：

```bash
npm install undici
```

## 基本用法

### 方法一：使用环境变量（推荐）

最简单的方法是使用标准的代理环境变量：

```typescript
import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { createFetchWithProxy, getProxyConfigFromEnv } from '@modelcontextprotocol/sdk/client/proxy';

// 从环境变量创建带代理的 transport
const transport = new StreamableHTTPClientTransport(new URL('https://mcp-server.example.com'), {
    fetch: createFetchWithProxy(getProxyConfigFromEnv())
});

const client = new Client({ name: 'my-client', version: '1.0.0' });
await client.connect(transport);
```

然后使用环境变量运行应用：

```bash
HTTP_PROXY=http://proxy.example.com:8080 \
HTTPS_PROXY=https://proxy.example.com:8443 \
NO_PROXY=localhost,127.0.0.1 \
node your-app.js
```

### 方法二：直接在代码中配置

也可以直接在代码中配置代理：

```typescript
import { createFetchWithProxy } from '@modelcontextprotocol/sdk/client/proxy';

const transport = new StreamableHTTPClientTransport(new URL('https://mcp-server.example.com'), {
    fetch: createFetchWithProxy({
        httpProxy: 'http://proxy.example.com:8080',
        httpsProxy: 'https://proxy.example.com:8443',
        noProxy: 'localhost,127.0.0.1,.internal'
    })
});
```

## 代理认证

需要认证的代理可以在 URL 中包含凭证：

```typescript
const transport = new StreamableHTTPClientTransport(new URL('https://mcp-server.example.com'), {
    fetch: createFetchWithProxy({
        httpProxy: 'http://username:password@proxy.example.com:8080',
        httpsProxy: 'https://username:password@proxy.example.com:8443'
    })
});
```

或通过环境变量：

```bash
HTTP_PROXY=http://username:password@proxy.example.com:8080
HTTPS_PROXY=https://username:password@proxy.example.com:8443
```

## NO_PROXY 配置

`NO_PROXY` 设置（或 `noProxy` 选项）指定哪些主机应绕过代理：

```typescript
const transport = new StreamableHTTPClientTransport(new URL('https://mcp-server.example.com'), {
    fetch: createFetchWithProxy({
        httpProxy: 'http://proxy.example.com:8080',
        noProxy: 'localhost,127.0.0.1,.local,.internal'
    })
});
```

`NO_PROXY` 支持的模式：

- 精确主机名：`example.com`
- 域名后缀：`.example.com`（匹配 `sub.example.com`）
- IP 地址：`127.0.0.1`
- 通配符：`*`（绕过所有主机的代理）

多个模式用逗号分隔。

## 支持的传输类型

代理配置适用于以下传输类型：

### StreamableHTTP（推荐）

```typescript
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { createFetchWithProxy, getProxyConfigFromEnv } from '@modelcontextprotocol/sdk/client/proxy';

const transport = new StreamableHTTPClientTransport(new URL('https://mcp-server.example.com'), {
    fetch: createFetchWithProxy(getProxyConfigFromEnv())
});
```

### SSE（向后兼容）

```typescript
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
import { createFetchWithProxy, getProxyConfigFromEnv } from '@modelcontextprotocol/sdk/client/proxy';

const transport = new SSEClientTransport(new URL('https://mcp-server.example.com'), {
    fetch: createFetchWithProxy(getProxyConfigFromEnv())
});
```

## 环境变量

SDK 识别以下标准代理环境变量（小写优先）：

- `HTTP_PROXY` / `http_proxy` - HTTP 请求的代理
- `HTTPS_PROXY` / `https_proxy` - HTTPS 请求的代理
- `NO_PROXY` / `no_proxy` - 要绕过的主机列表（逗号分隔）

## 完整示例

参见 [`src/examples/client/proxyClient.ts`](../src/examples/client/proxyClient.ts) 获取完整的可运行示例。

运行示例：

```bash
# 设置代理环境变量
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=https://proxy.example.com:8443
export NO_PROXY=localhost,127.0.0.1

# 运行示例
npx tsx src/examples/client/proxyClient.ts
```

## 故障排查

### "Proxy support requires the undici package"

安装 undici：

```bash
npm install undici
```

### 代理不工作

1. 验证代理 URL 是否正确（包括协议 `http://` 或 `https://`）
2. 检查代理是否需要认证
3. 确保目标服务器不在 `NO_PROXY` 列表中
4. 先用简单的 HTTP 客户端测试代理：

```typescript
import { ProxyAgent } from 'undici';

const response = await fetch('https://example.com', {
    // @ts-expect-error - dispatcher is undici-specific
    dispatcher: new ProxyAgent('http://proxy.example.com:8080')
});
```

### HTTPS 代理的 SSL/TLS 错误

如果使用 HTTPS 代理时遇到证书错误，可能需要配置代理的 CA 证书。这取决于您的代理服务器配置。

## API 参考

### `createFetchWithProxy(config: ProxyConfig): FetchLike`

创建配置了代理设置的 fetch 函数。

**参数：**

- `config.httpProxy` - HTTP 代理 URL（可选）
- `config.httpsProxy` - HTTPS 代理 URL（可选）
- `config.noProxy` - 要绕过的主机列表，逗号分隔（可选）

**返回：** 配置了代理的兼容 fetch 的函数

### `getProxyConfigFromEnv(): ProxyConfig`

从标准环境变量读取代理配置。

**返回：** 包含环境变量值的 `ProxyConfig` 对象

### `ProxyConfig` 接口

```typescript
interface ProxyConfig {
    httpProxy?: string;
    httpsProxy?: string;
    noProxy?: string;
}
```

## 技术实现

本实现使用 `undici` 包的 `ProxyAgent`，它与 Node.js fetch API 兼容。代理通过提供自定义 fetch 实现来配置，该实现将请求路由通过配置的 HTTP/HTTPS 代理。

主要特性：

- ✅ 支持标准环境变量（HTTP_PROXY、HTTPS_PROXY、NO_PROXY）
- ✅ 通过 URL 凭证进行代理认证
- ✅ NO_PROXY 绕过，支持多种模式类型（精确匹配、域名后缀、通配符）
- ✅ undici 不可用时的优雅降级
- ✅ 同时支持 StreamableHTTPClientTransport 和 SSEClientTransport

## 安全注意事项

1. **凭证保护**：避免在代码中硬编码代理凭证，优先使用环境变量
2. **HTTPS**：对于敏感数据，使用 HTTPS 代理而不是 HTTP 代理
3. **证书验证**：确保代理服务器使用有效的 SSL/TLS 证书
4. **访问控制**：限制哪些服务可以通过代理访问

## 相关资源

- [完整文档](../docs/proxy.md)（英文）
- [客户端文档](../docs/client.md)（英文）
- [示例代码](../src/examples/client/proxyClient.ts)
