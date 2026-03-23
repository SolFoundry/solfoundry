/**
 * SolFoundry Program Testing Framework - Mock & Spy Example
 * 
 * 展示 Mock 和 Spy 用法
 */

import { describe, it, expect, runTests, createMock, createSpy, createStub } from '../src/index';

// 示例服务接口
interface DatabaseService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string): Promise<any[]>;
  insert(table: string, data: any): Promise<number>;
  update(table: string, id: number, data: any): Promise<boolean>;
  delete(table: string, id: number): Promise<boolean>;
}

interface EmailService {
  send(to: string, subject: string, body: string): Promise<boolean>;
  sendBatch(emails: Array<{ to: string; subject: string; body: string }>): Promise<number>;
}

// 业务逻辑类
class UserService {
  constructor(
    private db: DatabaseService,
    private email: EmailService
  ) {}

  async registerUser(email: string, name: string): Promise<{ id: number; success: boolean }> {
    // 验证邮箱
    if (!email.includes('@')) {
      throw new Error('Invalid email');
    }

    // 插入数据库
    const id = await this.db.insert('users', { email, name });

    // 发送欢迎邮件
    await this.email.send(
      email,
      'Welcome!',
      `Hello ${name}, welcome to our platform!`
    );

    return { id, success: true };
  }

  async deleteUser(id: number): Promise<boolean> {
    const deleted = await this.db.delete('users', id);
    return deleted;
  }
}

describe('UserService with Mocks', () => {
  describe('registerUser()', () => {
    it('should register user and send welcome email', async () => {
      // 创建 Mock
      const mockDb = createMock<DatabaseService>();
      const mockEmail = createMock<EmailService>();

      // 配置 Mock 行为
      mockDb.method('insert').implements(async (table, data) => {
        expect(table).toBe('users');
        expect(data).toEqual({ email: 'test@example.com', name: 'Test User' });
        return 123;
      });

      mockEmail.method('send').returns(Promise.resolve(true));

      // 创建服务实例
      const service = new UserService(
        mockDb.getObject(),
        mockEmail.getObject()
      );

      // 执行测试
      const result = await service.registerUser('test@example.com', 'Test User');

      // 验证结果
      expect(result.id).toBe(123);
      expect(result.success).toBe(true);

      // 验证调用
      const dbVerifier = mockDb.verify();
      expect(dbVerifier.toHaveBeenCalled('insert')).toBe(true);
      expect(dbVerifier.toHaveBeenCalledTimes('insert', 1)).toBe(true);

      const emailVerifier = mockEmail.verify();
      expect(emailVerifier.toHaveBeenCalled('send')).toBe(true);
    });

    it('should throw on invalid email', async () => {
      const mockDb = createMock<DatabaseService>();
      const mockEmail = createMock<EmailService>();

      const service = new UserService(
        mockDb.getObject(),
        mockEmail.getObject()
      );

      await expect(async () => {
        await service.registerUser('invalid-email', 'Test');
      }).toThrow('Invalid email');

      // 验证数据库和邮件都没有被调用
      expect(mockDb.verify().toHaveBeenCalled('insert')).toBe(false);
      expect(mockEmail.verify().toHaveBeenCalled('send')).toBe(false);
    });

    it('should handle email send failure', async () => {
      const mockDb = createMock<DatabaseService>();
      const mockEmail = createMock<EmailService>();

      mockDb.method('insert').returns(Promise.resolve(456));
      mockEmail.method('send').throws(new Error('SMTP error'));

      const service = new UserService(
        mockDb.getObject(),
        mockEmail.getObject()
      );

      await expect(async () => {
        await service.registerUser('test@example.com', 'Test');
      }).toThrow('SMTP error');

      // 验证数据库插入仍然被调用
      expect(mockDb.verify().toHaveBeenCalled('insert')).toBe(true);
    });
  });
});

describe('Spy Examples', () => {
  it('should track function calls', () => {
    const originalFn = (x: number, y: number) => x + y;
    const spy = createSpy(originalFn);

    spy(2, 3);
    spy(4, 5);
    spy(6, 7);

    expect(spy.calls.count()).toBe(3);
    expect(spy.calls.argsFor(0)).toEqual([2, 3]);
    expect(spy.calls.argsFor(1)).toEqual([4, 5]);
    expect(spy.results.all()).toEqual([5, 9, 13]);

    spy.reset();
    expect(spy.calls.count()).toBe(0);
  });

  it('should spy on object methods', () => {
    const logger = {
      log: (msg: string) => console.log(msg),
      error: (msg: string) => console.error(msg),
      warn: (msg: string) => console.warn(msg),
    };

    const logSpy = createSpy(logger.log);
    logger.log = logSpy as any;

    logger.log('Hello');
    logger.log('World');

    expect(logSpy.calls.count()).toBe(2);
    expect(logSpy.calls.argsFor(0)).toEqual(['Hello']);
  });
});

describe('Stub Examples', () => {
  it('should create empty stub', () => {
    const stub = createStub<DatabaseService>();

    // Stub 所有方法都返回 undefined
    expect(stub.connect()).toBeUndefined();
    expect(stub.query('SELECT *')).toBeUndefined();
    expect(stub.insert('users', {})).toBeUndefined();
  });

  it('should allow method override', async () => {
    const stub = createStub<DatabaseService>();

    stub.connect = async () => {
      console.log('Connected!');
    };

    stub.query = async (sql) => {
      return [{ id: 1, name: 'Test' }];
    };

    await stub.connect();
    const result = await stub.query('SELECT * FROM users');
    expect(result).toEqual([{ id: 1, name: 'Test' }]);
  });
});

describe('Mock Return Value Sequences', () => {
  it('should return values in sequence', () => {
    const mockDb = createMock<DatabaseService>();

    mockDb.method('query')
      .returns(
        Promise.resolve([{ id: 1 }]),
        Promise.resolve([{ id: 2 }]),
        Promise.resolve([{ id: 3 }])
      );

    const db = mockDb.getObject();

    // 第一次调用返回第一个值
    // 第二次调用返回第二个值，依此类推
  });

  it('should throw errors in sequence', () => {
    const mockDb = createMock<DatabaseService>();

    mockDb.method('connect')
      .throws(
        new Error('Connection failed'),
        new Error('Timeout')
      );

    const db = mockDb.getObject();

    // 第一次调用抛出第一个错误
    // 第二次调用抛出第二个错误
  });
});

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}
