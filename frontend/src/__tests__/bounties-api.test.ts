import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listBounties } from '../api/bounties';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
    headers: new Headers({ 'content-type': 'application/json' }),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockResponse(body),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

describe('bounties API', () => {
  beforeEach(() => mockFetch.mockReset());

  it('passes the free-text query parameter when listing bounties', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ items: [], total: 0, limit: 12, offset: 0 }));

    await listBounties({ status: 'open', skill: 'React', q: 'wallet adapter', limit: 12 });

    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain('/api/bounties');
    expect(calledUrl).toContain('status=open');
    expect(calledUrl).toContain('skill=React');
    expect(calledUrl).toContain('q=wallet+adapter');
  });
});
