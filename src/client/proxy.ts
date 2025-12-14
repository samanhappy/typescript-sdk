/**
 * HTTP/HTTPS proxy configuration utilities for MCP client transports.
 *
 * This module provides utilities to configure HTTP and HTTPS proxies when
 * connecting to MCP servers. Proxies are configured by providing a custom
 * fetch implementation that uses Node.js http/https agents with proxy support.
 *
 * @example Basic proxy usage
 * ```typescript
 * import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
 * import { createFetchWithProxy } from '@modelcontextprotocol/sdk/client/proxy.js';
 *
 * const transport = new StreamableHTTPClientTransport(
 *   new URL('https://mcp-server.example.com'),
 *   {
 *     fetch: createFetchWithProxy({
 *       httpProxy: 'http://proxy.example.com:8080',
 *       httpsProxy: 'https://proxy.example.com:8443'
 *     })
 *   }
 * );
 * ```
 *
 * @example With authentication
 * ```typescript
 * const transport = new StreamableHTTPClientTransport(
 *   new URL('https://mcp-server.example.com'),
 *   {
 *     fetch: createFetchWithProxy({
 *       httpProxy: 'http://user:pass@proxy.example.com:8080',
 *       httpsProxy: 'https://user:pass@proxy.example.com:8443'
 *     })
 *   }
 * );
 * ```
 *
 * @example From environment variables
 * ```typescript
 * const transport = new StreamableHTTPClientTransport(
 *   new URL('https://mcp-server.example.com'),
 *   {
 *     fetch: createFetchWithProxy({
 *       httpProxy: process.env.HTTP_PROXY,
 *       httpsProxy: process.env.HTTPS_PROXY,
 *       noProxy: process.env.NO_PROXY
 *     })
 *   }
 * );
 * ```
 */

import { FetchLike } from '../shared/transport.js';

/**
 * Configuration options for HTTP/HTTPS proxy settings.
 */
export interface ProxyConfig {
    /**
     * HTTP proxy URL (e.g., 'http://proxy.example.com:8080')
     * Can include authentication: 'http://user:pass@proxy.example.com:8080'
     */
    httpProxy?: string;

    /**
     * HTTPS proxy URL (e.g., 'https://proxy.example.com:8443')
     * Can include authentication: 'https://user:pass@proxy.example.com:8443'
     */
    httpsProxy?: string;

    /**
     * Comma-separated list of hosts that should bypass the proxy
     * (e.g., 'localhost,127.0.0.1,.example.com')
     */
    noProxy?: string;
}

/**
 * Creates a fetch function that uses the specified proxy configuration.
 *
 * This function returns a fetch implementation that routes requests through
 * the configured HTTP/HTTPS proxies using Node.js http/https agents.
 *
 * Note: This function requires the 'undici' package or Node.js 18+ with
 * native fetch support that accepts custom agents via dispatcher option.
 *
 * @param config - Proxy configuration options
 * @returns A fetch-compatible function configured to use the specified proxies
 *
 * @example
 * ```typescript
 * const fetchWithProxy = createFetchWithProxy({
 *   httpProxy: 'http://proxy.example.com:8080',
 *   httpsProxy: 'https://proxy.example.com:8443'
 * });
 *
 * const transport = new StreamableHTTPClientTransport(
 *   new URL('https://mcp-server.example.com'),
 *   { fetch: fetchWithProxy }
 * );
 * ```
 */
export function createFetchWithProxy(config: ProxyConfig): FetchLike {
    // If no proxy is configured, return the default fetch
    if (!config.httpProxy && !config.httpsProxy) {
        return fetch;
    }

    // Parse no_proxy list
    const noProxyList = parseNoProxy(config.noProxy);

    return async (url: string | URL, init?: RequestInit): Promise<Response> => {
        const targetUrl = typeof url === 'string' ? new URL(url) : url;

        // Check if host should bypass proxy
        if (shouldBypassProxy(targetUrl.hostname, noProxyList)) {
            return fetch(url, init);
        }

        // Determine which proxy to use based on protocol
        const proxyUrl = targetUrl.protocol === 'https:' ? config.httpsProxy : config.httpProxy;

        if (!proxyUrl) {
            // No proxy configured for this protocol
            return fetch(url, init);
        }

        // Use undici for proxy support if available
        try {
            // Dynamic import - undici is an optional peer dependency
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const undici = await import('undici' as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ProxyAgent = (undici as any).ProxyAgent;
            const dispatcher = new ProxyAgent(proxyUrl);

            return fetch(url, {
                ...init,
                // @ts-expect-error - dispatcher is undici-specific
                dispatcher
            });
        } catch (error) {
            // undici not available, try using Node.js built-in http/https agents
            // Note: This is less ideal as Node.js fetch doesn't directly support agents
            throw new Error(
                'Proxy support requires the "undici" package. ' +
                    'Install it with: npm install undici\n' +
                    `Original error: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    };
}

/**
 * Parses a NO_PROXY environment variable value into a list of patterns.
 */
function parseNoProxy(noProxy?: string): string[] {
    if (!noProxy) {
        return [];
    }

    return noProxy
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
}

/**
 * Checks if a hostname should bypass the proxy based on NO_PROXY patterns.
 */
function shouldBypassProxy(hostname: string, noProxyList: string[]): boolean {
    if (noProxyList.length === 0) {
        return false;
    }

    const hostnameLower = hostname.toLowerCase();

    for (const pattern of noProxyList) {
        const patternLower = pattern.toLowerCase();

        // Exact match
        if (hostnameLower === patternLower) {
            return true;
        }

        // Domain suffix match (e.g., .example.com matches sub.example.com)
        if (patternLower.startsWith('.') && hostnameLower.endsWith(patternLower)) {
            return true;
        }

        // Domain suffix match without leading dot
        if (!patternLower.startsWith('.') && hostnameLower.endsWith('.' + patternLower)) {
            return true;
        }

        // Special case: "*" matches everything
        if (patternLower === '*') {
            return true;
        }
    }

    return false;
}

/**
 * Creates a ProxyConfig from environment variables.
 *
 * This function reads standard proxy environment variables:
 * - HTTP_PROXY, http_proxy
 * - HTTPS_PROXY, https_proxy
 * - NO_PROXY, no_proxy
 *
 * Lowercase versions take precedence over uppercase versions.
 *
 * @returns A ProxyConfig object populated from environment variables
 *
 * @example
 * ```typescript
 * const proxyConfig = getProxyConfigFromEnv();
 * const fetchWithProxy = createFetchWithProxy(proxyConfig);
 * ```
 */
export function getProxyConfigFromEnv(): ProxyConfig {
    return {
        httpProxy: process.env.http_proxy || process.env.HTTP_PROXY,
        httpsProxy: process.env.https_proxy || process.env.HTTPS_PROXY,
        noProxy: process.env.no_proxy || process.env.NO_PROXY
    };
}
