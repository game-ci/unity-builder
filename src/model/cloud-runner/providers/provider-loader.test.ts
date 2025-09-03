import loadProvider from './provider-loader';
import { ProviderInterface } from './provider-interface';

describe('provider-loader', () => {
  it('loads a provider dynamically', async () => {
    const provider: ProviderInterface = await loadProvider('./test', {} as any);
    expect(typeof provider.runTaskInWorkflow).toBe('function');
  });

  it('throws when provider package is missing', async () => {
    await expect(loadProvider('non-existent-package', {} as any)).rejects.toThrow('non-existent-package');
  });

  it('throws when provider does not implement ProviderInterface', async () => {
    await expect(loadProvider('./fixtures/invalid-provider', {} as any)).rejects.toThrow(
      'does not implement ProviderInterface',
    );
  });
});
