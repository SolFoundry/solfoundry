/**
 * WebSocket event subscription module for the SolFoundry SDK.
 *
 * Provides a typed event emitter over the SolFoundry WebSocket API
 * for receiving real-time bounty, submission, and payout events.
 * Includes automatic reconnection with exponential backoff.
 *
 * @module events
 */

import type { WebSocketEvent, WebSocketEventType } from './types.js';

/** Callback function for handling incoming WebSocket events. */
export type EventHandler = (event: WebSocketEvent) => void;

/** Callback for handling connection lifecycle events. */
export type ConnectionHandler = () => void;

/** Callback for handling WebSocket errors. */
export type ErrorHandler = (error: Error) => void;

/**
 * Configuration for the WebSocket event subscriber.
 */
export interface EventSubscriberConfig {
  /** WebSocket URL (e.g., "wss://api.solfoundry.io/ws"). */
  readonly wsUrl: string;
  /** Authentication token for the WebSocket connection. */
  readonly token?: string;
  /** Whether to automatically reconnect on disconnect. Defaults to true. */
  readonly autoReconnect?: boolean;
  /** Maximum number of reconnection attempts. Defaults to 10. */
  readonly maxReconnectAttempts?: number;
  /** Base delay for reconnection backoff in milliseconds. Defaults to 1000. */
  readonly reconnectBaseDelayMs?: number;
}

/**
 * Real-time event subscriber for the SolFoundry WebSocket API.
 *
 * Connects to the SolFoundry WebSocket endpoint and dispatches
 * typed events to registered handlers. Supports topic-based
 * subscriptions and automatic reconnection.
 *
 * The WebSocket protocol supports these message types:
 * - `subscribe`: Subscribe to a topic (e.g., a bounty ID)
 * - `unsubscribe`: Unsubscribe from a topic
 * - `broadcast`: Send a message to all subscribers of a topic
 * - `pong`: Keep-alive response
 *
 * @example
 * ```typescript
 * const subscriber = new EventSubscriber({
 *   wsUrl: 'wss://api.solfoundry.io/ws',
 *   token: 'your-auth-token',
 * });
 *
 * subscriber.on('bounty_created', (event) => {
 *   console.log('New bounty:', event.data);
 * });
 *
 * subscriber.onConnect(() => {
 *   subscriber.subscribe('bounty-uuid-123');
 * });
 *
 * await subscriber.connect();
 * ```
 */
export class EventSubscriber {
  private readonly wsUrl: string;
  private readonly token: string | undefined;
  private readonly autoReconnect: boolean;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectBaseDelayMs: number;

  private websocket: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private intentionalClose: boolean = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  private readonly eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private readonly connectHandlers: Set<ConnectionHandler> = new Set();
  private readonly disconnectHandlers: Set<ConnectionHandler> = new Set();
  private readonly errorHandlers: Set<ErrorHandler> = new Set();
  private readonly subscribedTopics: Set<string> = new Set();

  /**
   * Create a new EventSubscriber.
   *
   * @param config - WebSocket connection configuration.
   */
  constructor(config: EventSubscriberConfig) {
    this.wsUrl = config.wsUrl;
    this.token = config.token;
    this.autoReconnect = config.autoReconnect ?? true;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10;
    this.reconnectBaseDelayMs = config.reconnectBaseDelayMs ?? 1000;
  }

  /**
   * Register an event handler for a specific event type.
   *
   * Multiple handlers can be registered for the same event type.
   * Handlers are called in registration order when matching events arrive.
   *
   * @param eventType - The event type to listen for (e.g., "bounty_created").
   * @param handler - Callback invoked when a matching event is received.
   * @returns This instance for method chaining.
   */
  on(eventType: WebSocketEventType | string, handler: EventHandler): this {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
    return this;
  }

  /**
   * Remove a previously registered event handler.
   *
   * @param eventType - The event type the handler was registered for.
   * @param handler - The handler function to remove.
   * @returns This instance for method chaining.
   */
  off(eventType: WebSocketEventType | string, handler: EventHandler): this {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
    }
    return this;
  }

  /**
   * Register a handler for successful WebSocket connection.
   *
   * @param handler - Callback invoked when the connection is established.
   * @returns This instance for method chaining.
   */
  onConnect(handler: ConnectionHandler): this {
    this.connectHandlers.add(handler);
    return this;
  }

  /**
   * Register a handler for WebSocket disconnection.
   *
   * @param handler - Callback invoked when the connection is lost.
   * @returns This instance for method chaining.
   */
  onDisconnect(handler: ConnectionHandler): this {
    this.disconnectHandlers.add(handler);
    return this;
  }

  /**
   * Register a handler for WebSocket errors.
   *
   * @param handler - Callback invoked when a WebSocket error occurs.
   * @returns This instance for method chaining.
   */
  onError(handler: ErrorHandler): this {
    this.errorHandlers.add(handler);
    return this;
  }

  /**
   * Establish the WebSocket connection.
   *
   * Connects to the configured WebSocket URL with optional token
   * authentication. Resolves when the connection is established,
   * rejects if the initial connection fails.
   *
   * @returns Promise that resolves when connected.
   * @throws {Error} If the connection cannot be established.
   */
  async connect(): Promise<void> {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      return;
    }

    this.intentionalClose = false;
    this.reconnectAttempts = 0;

    return new Promise<void>((resolve, reject) => {
      const url = this.token ? `${this.wsUrl}?token=${this.token}` : this.wsUrl;

      try {
        this.websocket = new WebSocket(url);
      } catch (error) {
        reject(new Error(`Failed to create WebSocket connection: ${String(error)}`));
        return;
      }

      this.websocket.onopen = () => {
        this.reconnectAttempts = 0;
        this.startPingInterval();
        this.connectHandlers.forEach((handler) => handler());

        // Re-subscribe to previously subscribed topics after reconnection
        for (const topic of this.subscribedTopics) {
          this.sendMessage({ action: 'subscribe', topic });
        }

        resolve();
      };

      this.websocket.onmessage = (messageEvent: MessageEvent) => {
        this.handleMessage(messageEvent);
      };

      this.websocket.onerror = (errorEvent: Event) => {
        const error = new Error(`WebSocket error: ${String(errorEvent)}`);
        this.errorHandlers.forEach((handler) => handler(error));
        if (this.websocket?.readyState !== WebSocket.OPEN) {
          reject(error);
        }
      };

      this.websocket.onclose = () => {
        this.stopPingInterval();
        this.disconnectHandlers.forEach((handler) => handler());

        if (!this.intentionalClose && this.autoReconnect) {
          this.attemptReconnect();
        }
      };
    });
  }

  /**
   * Close the WebSocket connection gracefully.
   *
   * Stops automatic reconnection and closes the underlying socket.
   * All event handlers remain registered for potential future connections.
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.stopPingInterval();
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  /**
   * Subscribe to events for a specific topic (e.g., a bounty UUID).
   *
   * The server will push events related to this topic to the
   * connected client.
   *
   * @param topic - The topic identifier to subscribe to.
   */
  subscribe(topic: string): void {
    this.subscribedTopics.add(topic);
    this.sendMessage({ action: 'subscribe', topic });
  }

  /**
   * Unsubscribe from a previously subscribed topic.
   *
   * @param topic - The topic identifier to unsubscribe from.
   */
  unsubscribe(topic: string): void {
    this.subscribedTopics.delete(topic);
    this.sendMessage({ action: 'unsubscribe', topic });
  }

  /**
   * Check whether the WebSocket is currently connected.
   *
   * @returns True if the WebSocket is in the OPEN state.
   */
  isConnected(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN;
  }

  /**
   * Get the set of currently subscribed topics.
   *
   * @returns A read-only set of topic strings.
   */
  getSubscribedTopics(): ReadonlySet<string> {
    return this.subscribedTopics;
  }

  /**
   * Process an incoming WebSocket message and dispatch to handlers.
   *
   * Parses the message as JSON, extracts the event type, and calls
   * all registered handlers for that type.
   *
   * @param messageEvent - The raw WebSocket message event.
   */
  private handleMessage(messageEvent: MessageEvent): void {
    try {
      const data = JSON.parse(String(messageEvent.data)) as Record<string, unknown>;

      // Handle pong messages (keep-alive responses)
      if (data.type === 'pong') {
        return;
      }

      const event: WebSocketEvent = {
        type: (data.type as WebSocketEventType) ?? 'bounty_updated',
        data: (data.data as Record<string, unknown>) ?? data,
        timestamp: (data.timestamp as string) ?? new Date().toISOString(),
      };

      // Dispatch to type-specific handlers
      const handlers = this.eventHandlers.get(event.type);
      if (handlers) {
        handlers.forEach((handler) => handler(event));
      }

      // Dispatch to wildcard handlers (registered with "*")
      const wildcardHandlers = this.eventHandlers.get('*');
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => handler(event));
      }
    } catch (error) {
      const parseError = new Error(`Failed to parse WebSocket message: ${String(error)}`);
      this.errorHandlers.forEach((handler) => handler(parseError));
    }
  }

  /**
   * Send a JSON message through the WebSocket connection.
   *
   * No-ops if the WebSocket is not in the OPEN state.
   *
   * @param message - The message object to serialize and send.
   */
  private sendMessage(message: Record<string, unknown>): void {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  /**
   * Attempt to reconnect with exponential backoff.
   *
   * Each attempt waits longer: baseDelay * 2^attempt, capped at 30 seconds.
   * Gives up after maxReconnectAttempts.
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const error = new Error(
        `WebSocket reconnection failed after ${this.maxReconnectAttempts} attempts`,
      );
      this.errorHandlers.forEach((handler) => handler(error));
      return;
    }

    const delay = Math.min(
      this.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts),
      30_000,
    );
    this.reconnectAttempts += 1;

    setTimeout(() => {
      if (!this.intentionalClose) {
        this.connect().catch(() => {
          // Error will be handled by the error handlers
        });
      }
    }, delay);
  }

  /**
   * Start sending periodic ping messages to keep the connection alive.
   * Sends a ping every 30 seconds.
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      this.sendMessage({ action: 'ping' });
    }, 30_000);
  }

  /**
   * Stop the periodic ping timer.
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
