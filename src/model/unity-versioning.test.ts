import UnityVersioning from './unity-versioning';

describe('Unity Versioning', () => {
  describe('parse', () => {
    it('throws for empty string', () => {
      expect(() => UnityVersioning.parse('')).toThrow(Error);
    });

    it('parses from ProjectVersion.txt', () => {
      const projectVersionContents = `m_EditorVersion: 2021.3.4f1
      m_EditorVersionWithRevision: 2021.3.4f1 (cb45f9cae8b7)`;
      expect(UnityVersioning.parse(projectVersionContents)).toBe('2021.3.4f1');
    });

    it('parses Unity 6000 and newer from ProjectVersion.txt', () => {
      const projectVersionContents = `m_EditorVersion: 6000.0.0f1
      m_EditorVersionWithRevision: 6000.0.0f1 (cb45f9cae8b7)`;
      expect(UnityVersioning.parse(projectVersionContents)).toBe('6000.0.0f1');
    });
  });

  describe('read', () => {
    it('throws for invalid path', () => {
      expect(() => UnityVersioning.read('')).toThrow(Error);
    });

    it('reads from test-project', () => {
      expect(UnityVersioning.read('./test-project')).toBe('2021.3.4f1');
    });
  });

  describe('determineUnityVersion', () => {
    it('defaults to parsed version', () => {
      expect(UnityVersioning.determineUnityVersion('./test-project', 'auto')).toBe('2021.3.4f1');
    });

    it('use specified unityVersion', () => {
      expect(UnityVersioning.determineUnityVersion('./test-project', '1.2.3')).toBe('1.2.3');
    });
  });
});
