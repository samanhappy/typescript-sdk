import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { createFetchWithProxy, getProxyConfigFromEnv } from '../../src/client/proxy.js';

describe('proxy', () => {
    describe('getProxyConfigFromEnv', () => {
        beforeEach(() => {
            // Clear environment variables before each test
            delete process.env.HTTP_PROXY;
            delete process.env.http_proxy;
            delete process.env.HTTPS_PROXY;
            delete process.env.https_proxy;
            delete process.env.NO_PROXY;
            delete process.env.no_proxy;
        });

        it('should return empty config when no environment variables are set', () => {
            const config = getProxyConfigFromEnv();
            expect(config).toEqual({
                httpProxy: undefined,
                httpsProxy: undefined,
                noProxy: undefined
            });
        });

        it('should read uppercase environment variables', () => {
            process.env.HTTP_PROXY = 'http://proxy.example.com:8080';
            process.env.HTTPS_PROXY = 'https://proxy.example.com:8443';
            process.env.NO_PROXY = 'localhost,127.0.0.1';

            const config = getProxyConfigFromEnv();
            expect(config.httpProxy).toBe('http://proxy.example.com:8080');
            expect(config.httpsProxy).toBe('https://proxy.example.com:8443');
            expect(config.noProxy).toBe('localhost,127.0.0.1');
        });

        it('should read lowercase environment variables', () => {
            process.env.http_proxy = 'http://proxy.example.com:8080';
            process.env.https_proxy = 'https://proxy.example.com:8443';
            process.env.no_proxy = 'localhost,127.0.0.1';

            const config = getProxyConfigFromEnv();
            expect(config.httpProxy).toBe('http://proxy.example.com:8080');
            expect(config.httpsProxy).toBe('https://proxy.example.com:8443');
            expect(config.noProxy).toBe('localhost,127.0.0.1');
        });

        it('should prefer lowercase over uppercase', () => {
            process.env.HTTP_PROXY = 'http://upper.example.com:8080';
            process.env.http_proxy = 'http://lower.example.com:8080';
            process.env.HTTPS_PROXY = 'https://upper.example.com:8443';
            process.env.https_proxy = 'https://lower.example.com:8443';
            process.env.NO_PROXY = 'upper.local';
            process.env.no_proxy = 'lower.local';

            const config = getProxyConfigFromEnv();
            expect(config.httpProxy).toBe('http://lower.example.com:8080');
            expect(config.httpsProxy).toBe('https://lower.example.com:8443');
            expect(config.noProxy).toBe('lower.local');
        });
    });

    describe('createFetchWithProxy', () => {
        let mockFetch: Mock;

        beforeEach(() => {
            mockFetch = vi.fn();
            global.fetch = mockFetch as unknown as typeof global.fetch;
        });

        it('should return default fetch when no proxy is configured', async () => {
            const fetchWithProxy = createFetchWithProxy({});

            // Should just use global fetch
            expect(fetchWithProxy).toBe(global.fetch);
        });

        it('should bypass proxy for hosts in NO_PROXY list (exact match)', async () => {
            const mockResponse = new Response('success');
            mockFetch.mockResolvedValue(mockResponse);

            const fetchWithProxy = createFetchWithProxy({
                httpProxy: 'http://proxy.example.com:8080',
                noProxy: 'localhost,127.0.0.1'
            });

            await fetchWithProxy('http://localhost:3000/api');

            // Should call fetch directly without proxy
            expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api', undefined);
        });

        it('should bypass proxy for domain suffix match', async () => {
            const mockResponse = new Response('success');
            mockFetch.mockResolvedValue(mockResponse);

            const fetchWithProxy = createFetchWithProxy({
                httpProxy: 'http://proxy.example.com:8080',
                noProxy: '.local,.internal'
            });

            await fetchWithProxy('http://server.local/api');

            // Should call fetch directly without proxy
            expect(mockFetch).toHaveBeenCalledWith('http://server.local/api', undefined);
        });

        it('should bypass proxy for wildcard', async () => {
            const mockResponse = new Response('success');
            mockFetch.mockResolvedValue(mockResponse);

            const fetchWithProxy = createFetchWithProxy({
                httpProxy: 'http://proxy.example.com:8080',
                noProxy: '*'
            });

            await fetchWithProxy('http://any-server.example.com/api');

            // Should call fetch directly without proxy
            expect(mockFetch).toHaveBeenCalledWith('http://any-server.example.com/api', undefined);
        });

        it('should handle domain suffix without leading dot', async () => {
            const mockResponse = new Response('success');
            mockFetch.mockResolvedValue(mockResponse);

            const fetchWithProxy = createFetchWithProxy({
                httpProxy: 'http://proxy.example.com:8080',
                noProxy: 'example.com'
            });

            await fetchWithProxy('http://sub.example.com/api');

            // Should call fetch directly without proxy
            expect(mockFetch).toHaveBeenCalledWith('http://sub.example.com/api', undefined);
        });

        it('should throw error when proxy is needed but undici is not available', async () => {
            // Create proxy configuration
            const fetchWithProxy = createFetchWithProxy({
                httpProxy: 'http://proxy.example.com:8080',
                noProxy: 'localhost'
            });

            // For URLs not in NO_PROXY, it should try to use undici
            // Since undici is not available in test environment, it should throw an error
            await expect(fetchWithProxy('http://remote-server.example.com/api')).rejects.toThrow(/Proxy support requires.*undici/);
        });

        it('should throw error when HTTPS proxy is needed but undici is not available', async () => {
            const fetchWithProxy = createFetchWithProxy({
                httpsProxy: 'https://proxy.example.com:8443',
                noProxy: 'localhost'
            });

            // For HTTPS URLs not in NO_PROXY, it should try to use undici
            // Since undici is not available in test environment, it should throw an error
            await expect(fetchWithProxy('https://remote-server.example.com/api')).rejects.toThrow(/Proxy support requires.*undici/);
        });

        it('should use default fetch when no proxy configured for protocol', async () => {
            const mockResponse = new Response('success');
            mockFetch.mockResolvedValue(mockResponse);

            const fetchWithProxy = createFetchWithProxy({
                httpProxy: 'http://proxy.example.com:8080'
                // No HTTPS proxy configured
            });

            await fetchWithProxy('https://remote-server.example.com/api');

            // Should use default fetch since no HTTPS proxy is configured
            expect(mockFetch).toHaveBeenCalledWith('https://remote-server.example.com/api', undefined);
        });

        it('should handle URL objects', async () => {
            const mockResponse = new Response('success');
            mockFetch.mockResolvedValue(mockResponse);

            const fetchWithProxy = createFetchWithProxy({
                httpProxy: 'http://proxy.example.com:8080',
                noProxy: 'localhost'
            });

            await fetchWithProxy(new URL('http://localhost:3000/api'));

            // Should call fetch directly for localhost
            expect(mockFetch).toHaveBeenCalledWith(expect.any(URL), undefined);
        });

        it('should preserve RequestInit options when bypassing proxy', async () => {
            const mockResponse = new Response('success');
            mockFetch.mockResolvedValue(mockResponse);

            const fetchWithProxy = createFetchWithProxy({
                httpProxy: 'http://proxy.example.com:8080',
                noProxy: 'localhost'
            });

            const init: RequestInit = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test: 'data' })
            };

            await fetchWithProxy('http://localhost:3000/api', init);

            // Should pass init through
            expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api', init);
        });

        it('should throw error when proxy is needed for non-bypassed hosts', async () => {
            const fetchWithProxy = createFetchWithProxy({
                httpProxy: 'http://proxy.example.com:8080',
                noProxy: ''
            });

            // Empty NO_PROXY should not bypass any hosts
            // Should throw error since undici is not available in test environment
            await expect(fetchWithProxy('http://remote-server.example.com/api')).rejects.toThrow(/Proxy support requires.*undici/);
        });

        it('should handle NO_PROXY with extra spaces', async () => {
            const mockResponse = new Response('success');
            mockFetch.mockResolvedValue(mockResponse);

            const fetchWithProxy = createFetchWithProxy({
                httpProxy: 'http://proxy.example.com:8080',
                noProxy: ' localhost , 127.0.0.1 '
            });

            await fetchWithProxy('http://localhost:3000/api');

            // Should trim spaces and match localhost
            expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api', undefined);
        });

        it('should be case-insensitive for hostname matching', async () => {
            const mockResponse = new Response('success');
            mockFetch.mockResolvedValue(mockResponse);

            const fetchWithProxy = createFetchWithProxy({
                httpProxy: 'http://proxy.example.com:8080',
                noProxy: 'LocalHost,INTERNAL.EXAMPLE.COM'
            });

            await fetchWithProxy('http://localhost:3000/api');
            expect(mockFetch).toHaveBeenCalledTimes(1);

            mockFetch.mockClear();
            await fetchWithProxy('http://internal.example.com:3000/api');
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });
});
