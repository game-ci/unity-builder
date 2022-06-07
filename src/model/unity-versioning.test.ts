import UnityVersioning from './unity-versioning.ts';

describe('Unity Versioning', () => {
  describe('parse', () => {
    it('throws for empty string', () => {
      expect(() => UnityVersioning.parse('')).toThrow(Error);
    });

    it('parses from ProjectVersion.txt', () => {
      const projectVersionContents = `m_EditorVersion: 2019.2.11f1
      m_EditorVersionWithRevision: 2019.2.11f1 (5f859a4cfee5)`;
      expect(UnityVersioning.parse(projectVersionContents)).toBe('2019.2.11f1');
    });
  });

  describe('read', () => {
    it('throws for invalid path', () => {
      expect(() => UnityVersioning.read('')).toThrow(Error);
    });

    it('reads from test-project', () => {
      expect(UnityVersioning.read('./test-project')).toBe('2019.2.11f1');
    });
  });

  describe('determineUnityVersion', () => {
    it('defaults to parsed version', () => {
      expect(UnityVersioning.determineUnityVersion('./test-project', 'auto')).toBe('2019.2.11f1');
    });

    it('use specified unityVersion', () => {
      expect(UnityVersioning.determineUnityVersion('./test-project', '1.2.3')).toBe('1.2.3');
    });
  });
});
