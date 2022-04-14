import { Kernel } from './core/kernel.ts';

(async () => {
  const kernel = new Kernel();

  await kernel.run();
})();
