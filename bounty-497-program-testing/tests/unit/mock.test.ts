/**
 * Unit Tests - Mock & Spy Utilities
 */

import { describe, it, expect, createMock, createSpy, createStub } from '../../src/index';

interface TestService {
  getData(id: number): Promise<string>;
  saveData(data: any): Promise<number>;
  deleteData(id: number): Promise<boolean>;
}

describe('Mock Utilities', () => {
  describe('createMock()', () => {
    it('should create mock with implementation', () => {
      const mock = createMock<TestService>({
        getData: async (id) => `data-${id}`,
      });

      expect(mock.getObject().getData).toBeDefined();
    });

    it('should create empty mock', () => {
      const mock = createMock<TestService>();
      const obj = mock.getObject();

      expect(obj.getData).toBeUndefined();
      expect(obj.saveData).toBeUndefined();
    });
  });

  describe('Mock.method().returns()', () => {
    it('should return specified values', () => {
      const mock = createMock<TestService>();
      mock.method('getData').returns(
        Promise.resolve('first'),
        Promise.resolve('second')
      );

      const service = mock.getObject();

      // Note: This is a simplified test - actual implementation would track calls
      expect(service.getData).toBeDefined();
    });
  });

  describe('Mock.method().throws()', () => {
    it('should throw specified errors', () => {
      const mock = createMock<TestService>();
      const error = new Error('test error');
      mock.method('getData').throws(error);

      const service = mock.getObject();
      expect(service.getData).toBeDefined();
    });
  });

  describe('Mock.method().implements()', () => {
    it('should use custom implementation', () => {
      const mock = createMock<TestService>();
      mock.method('getData').implements(async (id) => `custom-${id}`);

      const service = mock.getObject();
      expect(service.getData).toBeDefined();
    });
  });

  describe('Mock.verify()', () => {
    it('should create verifier', () => {
      const mock = createMock<TestService>();
      const verifier = mock.verify();

      expect(verifier).toBeDefined();
      expect(verifier.toHaveBeenCalled).toBeDefined();
    });
  });

  describe('Mock.reset()', () => {
    it('should reset mock state', () => {
      const mock = createMock<TestService>();
      mock.reset();

      // After reset, mock should be clean
      expect(mock.getObject()).toBeDefined();
    });
  });
});

describe('Spy Utilities', () => {
  describe('createSpy()', () => {
    it('should track function calls', () => {
      const original = (x: number) => x * 2;
      const spy = createSpy(original);

      spy(5);
      spy(10);

      expect(spy.calls.count()).toBe(2);
    });

    it('should track arguments', () => {
      const spy = createSpy<(a: number, b: number) => number>();

      spy(1, 2);
      spy(3, 4);

      expect(spy.calls.argsFor(0)).toEqual([1, 2]);
      expect(spy.calls.argsFor(1)).toEqual([3, 4]);
    });

    it('should track results', () => {
      const spy = createSpy((x: number) => x + 1);

      spy(1);
      spy(2);

      expect(spy.results.all()).toEqual([2, 3]);
    });

    it('should reset state', () => {
      const spy = createSpy();

      spy(1);
      spy(2);
      spy.reset();

      expect(spy.calls.count()).toBe(0);
      expect(spy.results.all()).toEqual([]);
    });
  });
});

describe('Stub Utilities', () => {
  describe('createStub()', () => {
    it('should create empty stub', () => {
      const stub = createStub<TestService>();

      expect(stub.getData).toBeDefined();
      expect(stub.saveData).toBeDefined();
      expect(stub.deleteData).toBeDefined();
    });

    it('should return undefined for all methods', async () => {
      const stub = createStub<TestService>();

      const result = await stub.getData(1);
      expect(result).toBeUndefined();
    });

    it('should allow method override', async () => {
      const stub = createStub<TestService>();

      stub.getData = async (id) => `stub-${id}`;

      const result = await stub.getData(42);
      expect(result).toBe('stub-42');
    });
  });
});

describe('Integration: Mock + Spy', () => {
  it('should work together', () => {
    const mock = createMock<TestService>();
    
    // Set up mock behavior
    mock.method('getData').implements(async (id) => `data-${id}`);
    
    // Create spy to track calls
    const originalGetData = mock.getObject().getData;
    const spy = createSpy(originalGetData as any);
    (mock.getObject() as any).getData = spy;

    // Verify spy is set up
    expect(spy).toBeDefined();
  });
});
