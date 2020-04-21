using System;
using JetBrains.Annotations;
using UnityEditor;

namespace UnityBuilderAction.Versioning
{
  public class VersionApplicator
  {
    enum Strategy
    {
      None,
      Custom,
      SemanticCommit,
      SemanticClassic,
    }

    public static void SetVersionForBuild(string strategy, [CanBeNull] string version)
    {
      if (!Enum.TryParse<Strategy>(strategy, out Strategy validatedStrategy)) {
        throw new Exception($"Invalid versioning argument provided. {strategy} is not a valid strategy.");
      }

      switch (validatedStrategy) {
        case Strategy.None:
          return;
        case Strategy.Custom:
          ApplyCustomVersion(version);
          return;
        case Strategy.SemanticCommit:
          ApplySemanticCommitVersion();
          return;
        case Strategy.SemanticClassic:
          ApplySemanticClassicVersion();
          return;
        default:
          throw new NotImplementedException("Version strategy has not been implemented.");
      }
    }

    static void ApplyCustomVersion(string version)
    {
      Apply(version);
    }

    static void ApplySemanticCommitVersion()
    {
      string version = Git.GenerateSemanticCommitVersion();

      Apply(version);
    }

    static void ApplySemanticClassicVersion()
    {
      string version = Git.GenerateSemanticClassicVersion();

      Apply(version);
    }

    static void Apply(string version)
    {
      PlayerSettings.bundleVersion = version;
    }
  }
}
