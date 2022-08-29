import { VersioningStrategy } from './versioning-strategy.ts';

export class VersioningStrategies {
  public static get all() {
    return [VersioningStrategy.None, VersioningStrategy.Semantic, VersioningStrategy.Tag, VersioningStrategy.Custom];
  }
}
