import { MiddlewareService } from './middleware-service';
import { Middleware } from './middleware';

// Mock dependencies
jest.mock('../../orchestrator', () => ({
  __esModule: true,
  default: {
    buildParameters: {
      providerStrategy: 'aws',
      targetPlatform: 'StandaloneLinux64',
    },
  },
}));

jest.mock('../../options/orchestrator-options', () => ({
  __esModule: true,
  default: {
    providerStrategy: 'aws',
    middlewareFiles: ['code-signing', 'cache-optimizer'],
  },
}));

jest.mock('../core/orchestrator-logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    logWarning: jest.fn(),
  },
}));

describe('MiddlewareService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('parseMiddleware', () => {
    it('should parse a single middleware definition', () => {
      const yaml = `
name: test-middleware
type: command
priority: 50
trigger:
  phase: [build]
before:
  commands: echo "before"
after:
  commands: echo "after"
`;
      const result = MiddlewareService.parseMiddleware(yaml);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test-middleware');
      expect(result[0].type).toBe('command');
      expect(result[0].priority).toBe(50);
      expect(result[0].trigger.phase).toEqual(['build']);
      expect(result[0].before?.commands).toBe('echo "before"');
      expect(result[0].after?.commands).toBe('echo "after"');
    });

    it('should parse an array of middleware definitions', () => {
      const yaml = `
- name: first
  type: command
  trigger:
    phase: [setup]
  before:
    commands: echo "first"
- name: second
  type: container
  image: node:20
  trigger:
    phase: [build]
  after:
    commands: echo "second"
`;
      const result = MiddlewareService.parseMiddleware(yaml);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('first');
      expect(result[0].type).toBe('command');
      expect(result[1].name).toBe('second');
      expect(result[1].type).toBe('container');
      expect(result[1].image).toBe('node:20');
    });

    it('should handle string shorthand for before/after', () => {
      const yaml = `
name: shorthand
type: command
trigger:
  phase: [build]
before: echo "shorthand before"
after: echo "shorthand after"
`;
      const result = MiddlewareService.parseMiddleware(yaml);
      expect(result).toHaveLength(1);
      expect(result[0].before?.commands).toBe('echo "shorthand before"');
      expect(result[0].after?.commands).toBe('echo "shorthand after"');
    });

    it('should parse secrets', () => {
      const yaml = `
name: with-secrets
type: container
trigger:
  phase: [build]
secrets:
  - name: MY_SECRET
    value: secret-value
  - name: ANOTHER_SECRET
after:
  commands: echo "done"
`;
      const result = MiddlewareService.parseMiddleware(yaml);
      expect(result[0].secrets).toHaveLength(2);
      expect(result[0].secrets[0].ParameterKey).toBe('MY_SECRET');
      expect(result[0].secrets[0].ParameterValue).toBe('secret-value');
      expect(result[0].secrets[1].ParameterKey).toBe('ANOTHER_SECRET');
    });

    it('should default priority to 100', () => {
      const yaml = `
name: no-priority
type: command
trigger:
  phase: [build]
before: echo "test"
`;
      const result = MiddlewareService.parseMiddleware(yaml);
      expect(result[0].priority).toBe(100);
    });

    it('should default type to command', () => {
      const yaml = `
name: no-type
trigger:
  phase: [build]
before: echo "test"
`;
      const result = MiddlewareService.parseMiddleware(yaml);
      expect(result[0].type).toBe('command');
    });

    it('should return empty array for empty input', () => {
      expect(MiddlewareService.parseMiddleware('')).toEqual([]);
      expect(MiddlewareService.parseMiddleware('   ')).toEqual([]);
    });

    it('should normalize scalar trigger values to arrays', () => {
      const yaml = `
name: scalar-triggers
type: command
trigger:
  phase: build
  provider: aws
  platform: StandaloneLinux64
before: echo "test"
`;
      const result = MiddlewareService.parseMiddleware(yaml);
      expect(result[0].trigger.phase).toEqual(['build']);
      expect(result[0].trigger.provider).toEqual(['aws']);
      expect(result[0].trigger.platform).toEqual(['StandaloneLinux64']);
    });

    it('should handle per-phase image override for container type', () => {
      const yaml = `
name: multi-image
type: container
image: ubuntu
trigger:
  phase: [build]
before:
  image: node:20
  commands: npm install
after:
  image: python:3
  commands: python verify.py
`;
      const result = MiddlewareService.parseMiddleware(yaml);
      expect(result[0].image).toBe('ubuntu');
      expect(result[0].before?.image).toBe('node:20');
      expect(result[0].after?.image).toBe('python:3');
    });
  });

  describe('evaluateExpression', () => {
    it('should evaluate equality expressions', () => {
      process.env.TEST_VAR = 'hello';
      expect(MiddlewareService.evaluateExpression("env.TEST_VAR == 'hello'")).toBe(true);
      expect(MiddlewareService.evaluateExpression("env.TEST_VAR == 'world'")).toBe(false);
    });

    it('should evaluate inequality expressions', () => {
      process.env.TEST_VAR = 'hello';
      expect(MiddlewareService.evaluateExpression("env.TEST_VAR != 'world'")).toBe(true);
      expect(MiddlewareService.evaluateExpression("env.TEST_VAR != 'hello'")).toBe(false);
    });

    it('should evaluate truthy expressions', () => {
      process.env.DEFINED_VAR = 'yes';
      expect(MiddlewareService.evaluateExpression('env.DEFINED_VAR')).toBe(true);

      process.env.FALSE_VAR = 'false';
      expect(MiddlewareService.evaluateExpression('env.FALSE_VAR')).toBe(false);

      process.env.EMPTY_VAR = '';
      expect(MiddlewareService.evaluateExpression('env.EMPTY_VAR')).toBe(false);

      delete process.env.MISSING_VAR;
      expect(MiddlewareService.evaluateExpression('env.MISSING_VAR')).toBe(false);
    });

    it('should evaluate falsy expressions', () => {
      delete process.env.MISSING_VAR;
      expect(MiddlewareService.evaluateExpression('!env.MISSING_VAR')).toBe(true);

      process.env.DEFINED_VAR = 'yes';
      expect(MiddlewareService.evaluateExpression('!env.DEFINED_VAR')).toBe(false);
    });

    it('should default to true for unknown expressions', () => {
      expect(MiddlewareService.evaluateExpression('some unknown expression')).toBe(true);
    });

    it('should handle double-quoted values', () => {
      process.env.TEST_VAR = 'hello';
      expect(MiddlewareService.evaluateExpression('env.TEST_VAR == "hello"')).toBe(true);
    });
  });

  describe('evaluateTrigger', () => {
    it('should match when phase matches', () => {
      const trigger = { phase: ['build'] };
      expect(MiddlewareService.evaluateTrigger(trigger, 'build')).toBe(true);
      expect(MiddlewareService.evaluateTrigger(trigger, 'setup')).toBe(false);
    });

    it('should match multiple phases', () => {
      const trigger = { phase: ['setup', 'build'] };
      expect(MiddlewareService.evaluateTrigger(trigger, 'setup')).toBe(true);
      expect(MiddlewareService.evaluateTrigger(trigger, 'build')).toBe(true);
      expect(MiddlewareService.evaluateTrigger(trigger, 'pre-build')).toBe(false);
    });

    it('should filter by provider', () => {
      const trigger = { phase: ['build'], provider: ['k8s'] };
      // Mock provider is 'aws', so this should not match
      expect(MiddlewareService.evaluateTrigger(trigger, 'build')).toBe(false);

      const matchingTrigger = { phase: ['build'], provider: ['aws', 'k8s'] };
      expect(MiddlewareService.evaluateTrigger(matchingTrigger, 'build')).toBe(true);
    });

    it('should filter by platform', () => {
      const trigger = { phase: ['build'], platform: ['StandaloneWindows64'] };
      // Mock platform is 'StandaloneLinux64', so this should not match
      expect(MiddlewareService.evaluateTrigger(trigger, 'build')).toBe(false);

      const matchingTrigger = { phase: ['build'], platform: ['StandaloneLinux64'] };
      expect(MiddlewareService.evaluateTrigger(matchingTrigger, 'build')).toBe(true);
    });

    it('should evaluate when expressions', () => {
      process.env.FEATURE_FLAG = 'true';
      const trigger = { phase: ['build'], when: "env.FEATURE_FLAG == 'true'" };
      expect(MiddlewareService.evaluateTrigger(trigger, 'build')).toBe(true);

      process.env.FEATURE_FLAG = 'false';
      expect(MiddlewareService.evaluateTrigger(trigger, 'build')).toBe(false);
    });

    it('should require all conditions to pass (AND logic)', () => {
      process.env.FEATURE_FLAG = 'true';
      const trigger = {
        phase: ['build'],
        provider: ['k8s'], // won't match (mock provider is 'aws')
        when: "env.FEATURE_FLAG == 'true'", // would match
      };
      expect(MiddlewareService.evaluateTrigger(trigger, 'build')).toBe(false);
    });
  });

  describe('resolveCommandHooks', () => {
    const middleware: Middleware[] = [
      {
        name: 'low-priority',
        type: 'command',
        priority: 10,
        trigger: { phase: ['build'] },
        image: 'ubuntu',
        before: { commands: 'echo "low-before"' },
        after: { commands: 'echo "low-after"' },
        secrets: [],
        allowFailure: false,
      },
      {
        name: 'high-priority',
        type: 'command',
        priority: 90,
        trigger: { phase: ['build'] },
        image: 'ubuntu',
        before: { commands: 'echo "high-before"' },
        after: { commands: 'echo "high-after"' },
        secrets: [],
        allowFailure: false,
      },
      {
        name: 'container-type',
        type: 'container',
        priority: 50,
        trigger: { phase: ['build'] },
        image: 'node:20',
        before: { commands: 'echo "container"' },
        secrets: [],
        allowFailure: false,
      },
    ];

    it('should only return command type middleware', () => {
      const hooks = MiddlewareService.resolveCommandHooks(middleware, 'build', 'before');
      expect(hooks).toHaveLength(2);
      expect(hooks.every((h) => h.name.startsWith('middleware:'))).toBe(true);
      expect(hooks.find((h) => h.name.includes('container-type'))).toBeUndefined();
    });

    it('should order before hooks by ascending priority', () => {
      const hooks = MiddlewareService.resolveCommandHooks(middleware, 'build', 'before');
      expect(hooks[0].name).toBe('middleware:low-priority:before');
      expect(hooks[1].name).toBe('middleware:high-priority:before');
    });

    it('should order after hooks by descending priority (wrapping)', () => {
      const hooks = MiddlewareService.resolveCommandHooks(middleware, 'build', 'after');
      expect(hooks[0].name).toBe('middleware:high-priority:after');
      expect(hooks[1].name).toBe('middleware:low-priority:after');
    });

    it('should filter by phase', () => {
      const hooks = MiddlewareService.resolveCommandHooks(middleware, 'setup', 'before');
      expect(hooks).toHaveLength(0);
    });
  });

  describe('resolveContainerHooks', () => {
    const middleware: Middleware[] = [
      {
        name: 'container-a',
        type: 'container',
        priority: 20,
        trigger: { phase: ['pre-build'] },
        image: 'ubuntu',
        before: { commands: 'echo "a-before"' },
        after: { commands: 'echo "a-after"' },
        secrets: [],
        allowFailure: false,
      },
      {
        name: 'container-b',
        type: 'container',
        priority: 80,
        trigger: { phase: ['pre-build'] },
        image: 'node:20',
        before: { commands: 'echo "b-before"', image: 'python:3' },
        secrets: [],
        allowFailure: true,
      },
    ];

    it('should resolve container hooks with correct images', () => {
      const hooks = MiddlewareService.resolveContainerHooks(middleware, 'pre-build', 'before');
      expect(hooks).toHaveLength(2);
      expect(hooks[0].image).toBe('ubuntu'); // default image from middleware
      expect(hooks[1].image).toBe('python:3'); // per-phase override
    });

    it('should propagate allowFailure', () => {
      const hooks = MiddlewareService.resolveContainerHooks(middleware, 'pre-build', 'before');
      expect(hooks[0].allowFailure).toBe(false);
      expect(hooks[1].allowFailure).toBe(true);
    });

    it('should only include phases that have definitions', () => {
      // container-b has no after phase
      const hooks = MiddlewareService.resolveContainerHooks(middleware, 'pre-build', 'after');
      expect(hooks).toHaveLength(1);
      expect(hooks[0].name).toBe('middleware:container-a:after');
    });
  });

  describe('getMiddleware', () => {
    it('should sort by priority ascending', () => {
      const yaml = `
- name: high
  type: command
  priority: 200
  trigger:
    phase: [build]
  before: echo "high"
- name: low
  type: command
  priority: 5
  trigger:
    phase: [build]
  before: echo "low"
- name: medium
  type: command
  priority: 50
  trigger:
    phase: [build]
  before: echo "medium"
`;
      const result = MiddlewareService.getMiddleware(yaml);
      expect(result[0].name).toBe('low');
      expect(result[1].name).toBe('medium');
      expect(result[2].name).toBe('high');
    });
  });
});
