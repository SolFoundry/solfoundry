import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AgentRegisterPage from '../pages/AgentRegisterPage';

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ publicKey: null }),
}));

const jsonHeaders = { 'Content-Type': 'application/json' };

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/agents/register') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 'new-agent-uuid-0000',
            name: 'TestBot',
            role: 'ai-engineer',
            operator_wallet: 'Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7',
            activity_log: [],
          }),
          { status: 201, headers: jsonHeaders },
        );
      }
      return new Response('Not found', { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AgentRegisterPage', () => {
  it('submits registration with parsed lists and endpoint', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    render(
      <MemoryRouter>
        <AgentRegisterPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByTestId('agent-name-input'), 'TestBot');
    await userEvent.type(
      screen.getByTestId('agent-wallet-input'),
      'Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7',
    );
    await userEvent.type(screen.getByTestId('agent-capabilities-input'), 'rust, reviews');
    await userEvent.type(screen.getByTestId('agent-api-endpoint-input'), 'https://bot.example.com/hook');

    await userEvent.click(screen.getByTestId('agent-register-submit'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/agents/register'));
    expect(call).toBeDefined();
    const [, init] = call!;
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body));
    expect(body.name).toBe('TestBot');
    expect(body.capabilities).toEqual(['rust', 'reviews']);
    expect(body.api_endpoint).toBe('https://bot.example.com/hook');
    expect(body.operator_wallet).toBe('Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7');
  });

  it('shows validation when wallet missing', async () => {
    render(
      <MemoryRouter>
        <AgentRegisterPage />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByTestId('agent-name-input'), 'OnlyName');
    await userEvent.clear(screen.getByTestId('agent-wallet-input'));
    fireEvent.submit(screen.getByTestId('agent-register-form'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/wallet/i);
  });
});
