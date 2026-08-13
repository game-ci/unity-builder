// Thin wrapper: the actual build logic lives in game-ci/unity-engine-core.
// See game-ci/roadmap#11 (workstream 2) for the "thin wrapper" migration this is part of.
import { runMain } from '@game-ci/unity-engine-core/dist/unity-builder';

export { runMain };

if (process.env.NODE_ENV !== 'test') {
  runMain();
}
