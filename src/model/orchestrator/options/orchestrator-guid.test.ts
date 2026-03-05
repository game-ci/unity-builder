import OrchestratorNamespace from './orchestrator-guid';

describe('OrchestratorNamespace', () => {
  describe('generateGuid', () => {
    it('generates a guid with correct format', () => {
      const guid = OrchestratorNamespace.generateGuid('42', 'StandaloneLinux64');
      // Format: {runNumber}-{platform}-{nanoid4}
      expect(guid).toMatch(/^42-linux64-[a-z0-9]{4}$/);
    });

    it('strips "standalone" prefix from platform (case-insensitive)', () => {
      const guid = OrchestratorNamespace.generateGuid('1', 'StandaloneWindows64');
      expect(guid).toMatch(/^1-windows64-[a-z0-9]{4}$/);
    });

    it('lowercases platform name', () => {
      const guid = OrchestratorNamespace.generateGuid('5', 'Android');
      expect(guid).toMatch(/^5-android-[a-z0-9]{4}$/);
    });

    it('handles numeric run number', () => {
      const guid = OrchestratorNamespace.generateGuid(100, 'iOS');
      expect(guid).toMatch(/^100-ios-[a-z0-9]{4}$/);
    });

    it('generates unique guids on repeated calls', () => {
      const guids = new Set<string>();
      for (let i = 0; i < 20; i++) {
        guids.add(OrchestratorNamespace.generateGuid('1', 'StandaloneLinux64'));
      }
      // With 4 alphanumeric chars (36^4 = ~1.7M possibilities), 20 calls should almost certainly be unique
      expect(guids.size).toBeGreaterThan(1);
    });

    it('handles StandaloneOSX platform', () => {
      const guid = OrchestratorNamespace.generateGuid('7', 'StandaloneOSX');
      expect(guid).toMatch(/^7-osx-[a-z0-9]{4}$/);
    });

    it('handles WebGL platform (no standalone prefix)', () => {
      const guid = OrchestratorNamespace.generateGuid('3', 'WebGL');
      expect(guid).toMatch(/^3-webgl-[a-z0-9]{4}$/);
    });

    it('uses only lowercase alphanumeric characters in nanoid portion', () => {
      for (let i = 0; i < 10; i++) {
        const guid = OrchestratorNamespace.generateGuid('1', 'test');
        const nanoidPart = guid.split('-').pop()!;
        expect(nanoidPart).toMatch(/^[0-9a-z]{4}$/);
      }
    });
  });
});
