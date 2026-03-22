/**
 * Tests for the typed error hierarchy.
 *
 * Validates that each error class carries the correct HTTP status code,
 * machine-readable code, and request ID, and that the factory method
 * `fromApiResponse` maps status codes to the right subclasses.
 */

import { describe, it, expect } from 'vitest';
import {
  SolFoundryError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  LockError,
  RateLimitError,
  UpstreamError,
  ServerError,
  NetworkError,
  RetryExhaustedError,
} from '../errors.js';

describe('SolFoundryError', () => {
  it('should store message, statusCode, code, and requestId', () => {
    const error = new SolFoundryError('test msg', 500, 'TEST_CODE', 'req-123');
    expect(error.message).toBe('test msg');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('TEST_CODE');
    expect(error.requestId).toBe('req-123');
    expect(error.name).toBe('SolFoundryError');
  });

  it('should use defaults for missing parameters', () => {
    const error = new SolFoundryError('minimal');
    expect(error.statusCode).toBe(0);
    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.requestId).toBeNull();
  });

  it('should be an instance of Error', () => {
    const error = new SolFoundryError('base');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SolFoundryError);
  });
});

describe('SolFoundryError.fromApiResponse', () => {
  it('should create ValidationError for 400', () => {
    const error = SolFoundryError.fromApiResponse(400, {
      message: 'Invalid title',
      request_id: 'req-1',
      code: 'VALIDATION_ERROR',
    });
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Invalid title');
    expect(error.requestId).toBe('req-1');
  });

  it('should create AuthenticationError for 401', () => {
    const error = SolFoundryError.fromApiResponse(401, {
      message: 'Token expired',
      request_id: null,
      code: 'AUTH_ERROR',
    });
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.statusCode).toBe(401);
  });

  it('should create AuthorizationError for 403', () => {
    const error = SolFoundryError.fromApiResponse(403, {
      message: 'Not authorized',
      request_id: null,
      code: 'FORBIDDEN',
    });
    expect(error).toBeInstanceOf(AuthorizationError);
    expect(error.statusCode).toBe(403);
  });

  it('should create NotFoundError for 404', () => {
    const error = SolFoundryError.fromApiResponse(404, {
      message: 'Bounty not found',
      request_id: 'req-2',
      code: 'NOT_FOUND',
    });
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.statusCode).toBe(404);
  });

  it('should create ConflictError for 409', () => {
    const error = SolFoundryError.fromApiResponse(409, {
      message: 'Escrow exists',
      request_id: null,
      code: 'CONFLICT',
    });
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.statusCode).toBe(409);
  });

  it('should create LockError for 423', () => {
    const error = SolFoundryError.fromApiResponse(423, {
      message: 'Resource locked',
      request_id: null,
      code: 'LOCKED',
    });
    expect(error).toBeInstanceOf(LockError);
    expect(error.statusCode).toBe(423);
  });

  it('should create RateLimitError for 429', () => {
    const error = SolFoundryError.fromApiResponse(429, {
      message: 'Too many requests',
      request_id: null,
      code: 'RATE_LIMITED',
    });
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.statusCode).toBe(429);
  });

  it('should create UpstreamError for 502', () => {
    const error = SolFoundryError.fromApiResponse(502, {
      message: 'Solana RPC failed',
      request_id: null,
      code: 'UPSTREAM_ERROR',
    });
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error.statusCode).toBe(502);
  });

  it('should create ServerError for other 5xx', () => {
    const error = SolFoundryError.fromApiResponse(503, {
      message: 'Service unavailable',
      request_id: null,
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(error).toBeInstanceOf(ServerError);
    expect(error.statusCode).toBe(503);
  });

  it('should create base SolFoundryError for unknown status codes', () => {
    const error = SolFoundryError.fromApiResponse(418, {
      message: 'I am a teapot',
      request_id: null,
      code: 'TEAPOT',
    });
    expect(error).toBeInstanceOf(SolFoundryError);
    expect(error.statusCode).toBe(418);
  });

  it('should handle empty message and code', () => {
    const error = SolFoundryError.fromApiResponse(400, {
      message: '',
      request_id: null,
      code: '',
    });
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Unknown error');
    expect(error.code).toBe('HTTP_400');
  });
});

describe('ValidationError', () => {
  it('should have correct name and status', () => {
    const error = new ValidationError('bad input');
    expect(error.name).toBe('ValidationError');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('should be an instance of SolFoundryError', () => {
    const error = new ValidationError('bad');
    expect(error).toBeInstanceOf(SolFoundryError);
  });
});

describe('AuthenticationError', () => {
  it('should have correct name and status', () => {
    const error = new AuthenticationError('no token');
    expect(error.name).toBe('AuthenticationError');
    expect(error.statusCode).toBe(401);
  });
});

describe('AuthorizationError', () => {
  it('should have correct name and status', () => {
    const error = new AuthorizationError('forbidden');
    expect(error.name).toBe('AuthorizationError');
    expect(error.statusCode).toBe(403);
  });
});

describe('NotFoundError', () => {
  it('should have correct name and status', () => {
    const error = new NotFoundError('missing');
    expect(error.name).toBe('NotFoundError');
    expect(error.statusCode).toBe(404);
  });
});

describe('ConflictError', () => {
  it('should have correct name and status', () => {
    const error = new ConflictError('conflict');
    expect(error.name).toBe('ConflictError');
    expect(error.statusCode).toBe(409);
  });
});

describe('LockError', () => {
  it('should have correct name and status', () => {
    const error = new LockError('locked');
    expect(error.name).toBe('LockError');
    expect(error.statusCode).toBe(423);
  });
});

describe('RateLimitError', () => {
  it('should have correct name and status', () => {
    const error = new RateLimitError('rate limited');
    expect(error.name).toBe('RateLimitError');
    expect(error.statusCode).toBe(429);
  });
});

describe('UpstreamError', () => {
  it('should have correct name and status', () => {
    const error = new UpstreamError('upstream');
    expect(error.name).toBe('UpstreamError');
    expect(error.statusCode).toBe(502);
  });
});

describe('ServerError', () => {
  it('should have correct name and configurable status', () => {
    const error = new ServerError('server error', 503);
    expect(error.name).toBe('ServerError');
    expect(error.statusCode).toBe(503);
  });

  it('should default to 500', () => {
    const error = new ServerError('default');
    expect(error.statusCode).toBe(500);
  });
});

describe('NetworkError', () => {
  it('should wrap the original error cause', () => {
    const cause = new TypeError('fetch failed');
    const error = new NetworkError('Network failed', cause);
    expect(error.name).toBe('NetworkError');
    expect(error.statusCode).toBe(0);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.cause).toBe(cause);
  });
});

describe('RetryExhaustedError', () => {
  it('should store attempts and lastError', () => {
    const lastError = new ServerError('server down', 503);
    const error = new RetryExhaustedError(3, lastError);
    expect(error.name).toBe('RetryExhaustedError');
    expect(error.attempts).toBe(3);
    expect(error.lastError).toBe(lastError);
    expect(error.code).toBe('RETRY_EXHAUSTED');
    expect(error.message).toContain('3 retry attempts');
    expect(error.message).toContain('server down');
  });
});
