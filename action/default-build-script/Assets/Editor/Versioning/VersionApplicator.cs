using System;
using JetBrains.Annotations;
using UnityEditor;

namespace UnityBuilderAction.Versioning
{
  public class VersionApplicator
  {
    public static void SetVersion(string version)
    {
      if (version == "none") {
        return;
      }
      
      Apply(version);
    }

    static void Apply(string version)
    {
      PlayerSettings.bundleVersion = version;
    }
  }
}
