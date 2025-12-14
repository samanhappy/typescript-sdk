/**
 * Example demonstrating how to use HTTP/HTTPS proxy configuration with MCP client.
 *
 * This example shows different ways to configure proxies:
 * 1. Direct proxy configuration
 * 2. Using environment variables
 * 3. With authentication
 * 4. With NO_PROXY exclusions
 *
 * Prerequisites:
 * - Install undici: npm install undici
 * - Set up a proxy server (or use a public one for testing)
 *
 * Usage:
 * ```bash
 * # With environment variables
 * HTTP_PROXY=http://proxy.example.com:8080 \
 * HTTPS_PROXY=https://proxy.example.com:8443 \
 * NO_PROXY=localhost,127.0.0.1 \
 * npx tsx src/examples/client/proxyClient.ts
 *
 * # Or edit the code below to set proxy URLs directly
 * ```
 */

import { Client } from '../../client/index.js';
import { StreamableHTTPClientTransport } from '../../client/streamableHttp.js';
import { createFetchWithProxy, getProxyConfigFromEnv } from '../../client/proxy.js';

async function main() {
    console.log('MCP Client with Proxy Configuration Example');
    console.log('===========================================\n');

    // Example 1: Using environment variables
    console.log('Example 1: Using environment variables');
    console.log('---------------------------------------');
    const envProxyConfig = getProxyConfigFromEnv();
    console.log('Proxy configuration from environment:');
    console.log(`  HTTP_PROXY: ${envProxyConfig.httpProxy || '(not set)'}`);
    console.log(`  HTTPS_PROXY: ${envProxyConfig.httpsProxy || '(not set)'}`);
    console.log(`  NO_PROXY: ${envProxyConfig.noProxy || '(not set)'}`);
    console.log();

    // Example 2: Direct proxy configuration
    console.log('Example 2: Direct proxy configuration');
    console.log('--------------------------------------');
    const directProxyConfig = {
        httpProxy: 'http://proxy.example.com:8080',
        httpsProxy: 'https://proxy.example.com:8443',
        noProxy: 'localhost,127.0.0.1,.local'
    };
    console.log('Direct proxy configuration:');
    console.log(`  HTTP Proxy: ${directProxyConfig.httpProxy}`);
    console.log(`  HTTPS Proxy: ${directProxyConfig.httpsProxy}`);
    console.log(`  NO_PROXY: ${directProxyConfig.noProxy}`);
    console.log();

    // Example 3: Proxy with authentication
    console.log('Example 3: Proxy with authentication');
    console.log('-------------------------------------');
    const authProxyConfig = {
        httpProxy: 'http://username:password@proxy.example.com:8080',
        httpsProxy: 'https://username:password@proxy.example.com:8443'
    };
    console.log('Proxy with authentication (credentials hidden):');
    console.log(`  HTTP Proxy: http://***:***@proxy.example.com:8080`);
    console.log(`  HTTPS Proxy: https://***:***@proxy.example.com:8443`);
    console.log();

    // Example 4: Actually connecting with proxy
    console.log('Example 4: Connecting to MCP server with proxy');
    console.log('-----------------------------------------------');

    // Choose which config to use (prefer environment, fallback to example)
    const proxyConfig = envProxyConfig.httpProxy || envProxyConfig.httpsProxy ? envProxyConfig : null;

    if (!proxyConfig) {
        console.log('No proxy configured via environment variables.');
        console.log('To use this example with a real proxy:');
        console.log('  1. Set HTTP_PROXY and/or HTTPS_PROXY environment variables');
        console.log('  2. Install undici: npm install undici');
        console.log('  3. Run this example again');
        console.log('\nExample:');
        console.log('  HTTP_PROXY=http://proxy.example.com:8080 npx tsx src/examples/client/proxyClient.ts');
        return;
    }

    try {
        // Create a client
        const client = new Client(
            {
                name: 'proxy-example-client',
                version: '1.0.0'
            },
            {
                capabilities: {}
            }
        );

        // Create transport with proxy configuration
        const serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
        console.log(`Connecting to: ${serverUrl}`);
        console.log('Using proxy configuration from environment variables...');

        const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
            fetch: createFetchWithProxy(proxyConfig)
        });

        client.onerror = error => {
            console.error('Client error:', error);
        };

        // Connect to the server
        await client.connect(transport);
        console.log('✓ Successfully connected to MCP server via proxy');

        // List available tools
        const tools = await client.listTools();
        console.log(`\nAvailable tools: ${tools.tools.length}`);
        tools.tools.forEach(tool => {
            console.log(`  - ${tool.name}: ${tool.description}`);
        });

        // Close the connection
        await transport.close();
        console.log('\n✓ Connection closed');
    } catch (error) {
        console.error('Error:', error);
        if (error instanceof Error && error.message.includes('undici')) {
            console.log('\nNote: Proxy support requires the undici package.');
            console.log('Install it with: npm install undici');
        }
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
