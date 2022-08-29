import UnityVersionDetector from './unity-version-detector.ts';

describe('Unity Versioning', () => {
  describe('parse', () => {
    it('throws for empty string', () => {
      expect(() => UnityVersionDetector.parse('')).toThrow(Error);
    });

    it('parses from ProjectVersion.txt', () => {
      const projectVersionContents = `m_EditorVersion: 2019.2.11f1
      m_EditorVersionWithRevision: 2019.2.11f1 (5f859a4cfee5)`;
      expect(UnityVersionDetector.parse(projectVersionContents)).toBe('2019.2.11f1');
    });
  });

  describe('read', () => {
    it('throws for invalid path', () => {
      expect(() => UnityVersionDetector.read('')).toThrow(Error);
    });

    it('reads from test-project', () => {
      expect(UnityVersionDetector.read('./test-project')).toBe('2019.2.11f1');
    });
  });

  describe('determineUnityVersion', () => {
    it('defaults to parsed version', () => {
      expect(UnityVersionDetector.determineUnityVersion('./test-project', 'auto')).toBe('2019.2.11f1');
    });

    it('use specified unityVersion', () => {
      expect(UnityVersionDetector.determineUnityVersion('./test-project', '1.2.3')).toBe('1.2.3');
    });
  });
});
