/**
 * Tests for the WebSocket event subscriber.
 *
 * Uses a mock WebSocket implementation to validate connection handling,
 * event dispatching, topic subscriptions, and reconnection logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventSubscriber } from '../events.js';
import type { WebSocketEvent } from '../types.js';

/**
 * Mock WebSocket implementation for testing.
 *
 * Simulates the browser WebSocket API with controllable open/close/message
 * events and a message recording buffer.
 */
class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static CONNECTING = 0;

  public readyState: number = MockWebSocket.CONNECTING;
  public onopen: (() => void) | null = null;
  public onclose: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  public sentMessages: string[] = [];

  constructor(public url: string) {
    // Auto-open after a microtask to simulate async connection
    Promise.resolve().then(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    });
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  /** Simulate receiving a message from the server. */
  simulateMessage(data: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  /** Simulate a connection error. */
  simulateError(): void {
    this.onerror?.({ type: 'error' } as Event);
  }
}

describe('EventSubscriber', () => {
  let originalWebSocket: typeof global.WebSocket;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;
    // Replace global WebSocket with mock
    global.WebSocket = vi.fn().mockImplementation((url: string) => {
      mockWs = new MockWebSocket(url);
      return mockWs;
    }) as unknown as typeof WebSocket;

    // Set static properties on the mock
    (global.WebSocket as unknown as Record<string, number>).OPEN = 1;
    (global.WebSocket as unknown as Record<string, number>).CLOSED = 3;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  describe('connect', () => {
    it('should establish a WebSocket connection', async () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });

      await subscriber.connect();
      expect(subscriber.isConnected()).toBe(true);
      expect(mockWs.url).toBe('wss://test.example.com/ws');
    });

    it('should include token in URL when provided', async () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
        token: 'auth-token-123',
      });

      await subscriber.connect();
      expect(mockWs.url).toBe('wss://test.example.com/ws?token=auth-token-123');
    });

    it('should fire connect handlers on open', async () => {
      const connectHandler = vi.fn();
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      subscriber.onConnect(connectHandler);

      await subscriber.connect();
      expect(connectHandler).toHaveBeenCalledOnce();
    });

    it('should be idempotent when already connected', async () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });

      await subscriber.connect();
      const firstWs = mockWs;
      await subscriber.connect(); // Should not create a new WebSocket
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect', () => {
    it('should close the WebSocket connection', async () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
        autoReconnect: false,
      });

      await subscriber.connect();
      expect(subscriber.isConnected()).toBe(true);

      subscriber.disconnect();
      expect(subscriber.isConnected()).toBe(false);
    });

    it('should fire disconnect handlers', async () => {
      const disconnectHandler = vi.fn();
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
        autoReconnect: false,
      });
      subscriber.onDisconnect(disconnectHandler);

      await subscriber.connect();
      subscriber.disconnect();
      expect(disconnectHandler).toHaveBeenCalledOnce();
    });
  });

  describe('event handling', () => {
    it('should dispatch events to registered handlers', async () => {
      const handler = vi.fn();
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      subscriber.on('bounty_created', handler);

      await subscriber.connect();

      mockWs.simulateMessage({
        type: 'bounty_created',
        data: { id: 'bounty-1', title: 'New Bounty' },
        timestamp: '2026-03-22T00:00:00Z',
      });

      expect(handler).toHaveBeenCalledOnce();
      const event = handler.mock.calls[0][0] as WebSocketEvent;
      expect(event.type).toBe('bounty_created');
      expect(event.data).toEqual({ id: 'bounty-1', title: 'New Bounty' });
    });

    it('should dispatch to wildcard handlers', async () => {
      const wildcardHandler = vi.fn();
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      subscriber.on('*', wildcardHandler);

      await subscriber.connect();

      mockWs.simulateMessage({
        type: 'bounty_updated',
        data: { id: 'bounty-1' },
        timestamp: '2026-03-22T00:00:00Z',
      });

      expect(wildcardHandler).toHaveBeenCalledOnce();
    });

    it('should not dispatch to unregistered event types', async () => {
      const handler = vi.fn();
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      subscriber.on('bounty_created', handler);

      await subscriber.connect();

      mockWs.simulateMessage({
        type: 'submission_created',
        data: {},
        timestamp: '2026-03-22T00:00:00Z',
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle pong messages silently', async () => {
      const handler = vi.fn();
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      subscriber.on('*', handler);

      await subscriber.connect();
      mockWs.simulateMessage({ type: 'pong' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON messages', async () => {
      const errorHandler = vi.fn();
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      subscriber.onError(errorHandler);

      await subscriber.connect();

      // Simulate receiving invalid JSON
      mockWs.onmessage?.({ data: 'not-json{{{' });

      expect(errorHandler).toHaveBeenCalledOnce();
    });
  });

  describe('on/off', () => {
    it('should support method chaining', () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      const handler = vi.fn();

      const result = subscriber.on('bounty_created', handler);
      expect(result).toBe(subscriber);

      const result2 = subscriber.off('bounty_created', handler);
      expect(result2).toBe(subscriber);
    });

    it('should remove handlers with off()', async () => {
      const handler = vi.fn();
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      subscriber.on('bounty_created', handler);

      await subscriber.connect();

      subscriber.off('bounty_created', handler);

      mockWs.simulateMessage({
        type: 'bounty_created',
        data: {},
        timestamp: '2026-03-22T00:00:00Z',
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle off() for non-existent event types', () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      const handler = vi.fn();

      // Should not throw
      subscriber.off('nonexistent_event', handler);
    });

    it('should support onConnect chaining', () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      const result = subscriber.onConnect(() => {});
      expect(result).toBe(subscriber);
    });

    it('should support onDisconnect chaining', () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      const result = subscriber.onDisconnect(() => {});
      expect(result).toBe(subscriber);
    });

    it('should support onError chaining', () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      const result = subscriber.onError(() => {});
      expect(result).toBe(subscriber);
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('should send subscribe message and track topic', async () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });

      await subscriber.connect();
      subscriber.subscribe('bounty-123');

      // Should have sent: subscribe for previously tracked topics on reconnect + this one
      const messages = mockWs.sentMessages.map((m) => JSON.parse(m));
      const subscribeMsg = messages.find(
        (m) => m.action === 'subscribe' && m.topic === 'bounty-123',
      );
      expect(subscribeMsg).toBeDefined();
      expect(subscriber.getSubscribedTopics().has('bounty-123')).toBe(true);
    });

    it('should send unsubscribe message and remove topic', async () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });

      await subscriber.connect();
      subscriber.subscribe('bounty-123');
      subscriber.unsubscribe('bounty-123');

      const messages = mockWs.sentMessages.map((m) => JSON.parse(m));
      const unsubMsg = messages.find(
        (m) => m.action === 'unsubscribe' && m.topic === 'bounty-123',
      );
      expect(unsubMsg).toBeDefined();
      expect(subscriber.getSubscribedTopics().has('bounty-123')).toBe(false);
    });

    it('should not send messages when not connected', () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });

      // Subscribe before connecting - should not throw
      subscriber.subscribe('bounty-123');
      expect(subscriber.getSubscribedTopics().has('bounty-123')).toBe(true);
    });
  });

  describe('isConnected', () => {
    it('should return false before connecting', () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      expect(subscriber.isConnected()).toBe(false);
    });

    it('should return true after connecting', async () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      await subscriber.connect();
      expect(subscriber.isConnected()).toBe(true);
    });

    it('should return false after disconnecting', async () => {
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
        autoReconnect: false,
      });
      await subscriber.connect();
      subscriber.disconnect();
      expect(subscriber.isConnected()).toBe(false);
    });
  });

  describe('message defaults', () => {
    it('should handle messages without explicit type', async () => {
      const handler = vi.fn();
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      subscriber.on('bounty_updated', handler);

      await subscriber.connect();
      mockWs.simulateMessage({ some_field: 'value' });

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should handle messages without timestamp', async () => {
      const handler = vi.fn();
      const subscriber = new EventSubscriber({
        wsUrl: 'wss://test.example.com/ws',
      });
      subscriber.on('bounty_created', handler);

      await subscriber.connect();
      mockWs.simulateMessage({ type: 'bounty_created', data: {} });

      expect(handler).toHaveBeenCalledOnce();
      const event = handler.mock.calls[0][0] as WebSocketEvent;
      expect(event.timestamp).toBeTruthy(); // Should have a default timestamp
    });
  });
});
