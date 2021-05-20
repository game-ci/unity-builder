using System;
using System.Linq;
using System.Reflection;
using UnityBuilderAction.Input;
using UnityBuilderAction.Reporting;
using UnityBuilderAction.Versioning;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace UnityBuilderAction
{
  static class Builder
  {
    public static void BuildProject()
    {
      // Gather values from args
      var options = ArgumentsParser.GetValidatedOptions();

      // Gather values from project
      var scenes = EditorBuildSettings.scenes.Where(scene => scene.enabled).Select(s => s.path).ToArray();
      
      // Get all buildOptions from options
      BuildOptions buildOptions = BuildOptions.None;
      foreach (string buildOptionString in Enum.GetNames(typeof(BuildOptions))) {
        if (options.ContainsKey(buildOptionString)) {
          BuildOptions buildOptionEnum = (BuildOptions) Enum.Parse(typeof(BuildOptions), buildOptionString);
          buildOptions |= buildOptionEnum;
        }
      }

      // Define BuildPlayer Options
      var buildPlayerOptions = new BuildPlayerOptions {
        scenes = scenes,
        locationPathName = options["customBuildPath"],
        target = (BuildTarget) Enum.Parse(typeof(BuildTarget), options["buildTarget"]),
        options = buildOptions
      };

      // Set version for this build
      VersionApplicator.SetVersion(options["buildVersion"]);
      VersionApplicator.SetAndroidVersionCode(options["androidVersionCode"]);
      
      // Apply Android settings
      if (buildPlayerOptions.target == BuildTarget.Android)
        AndroidSettings.Apply(options);

      // Execute default AddressableAsset content build, if the package is installed.
      // Version defines would be the best solution here, but Unity 2018 doesn't support that,
      // so we fall back to using reflection instead.
      var addressableAssetSettingsType = Type.GetType(
        "UnityEditor.AddressableAssets.Settings.AddressableAssetSettings,Unity.Addressables.Editor");
      if (addressableAssetSettingsType != null)
      {
        // ReSharper disable once PossibleNullReferenceException, used from try-catch
        try
        {
          addressableAssetSettingsType.GetMethod("CleanPlayerContent", BindingFlags.Static | BindingFlags.Public)
                .Invoke(null, new object[] {null});
          addressableAssetSettingsType.GetMethod("BuildPlayerContent", new Type[0]).Invoke(null, new object[0]);
        }
        catch (Exception e)
        {
          Debug.LogError($"Failed to run default addressables build:\n{e}");
        }
      }

      // Perform build
      BuildReport buildReport = BuildPipeline.BuildPlayer(buildPlayerOptions);

      // Summary
      BuildSummary summary = buildReport.summary;
      StdOutReporter.ReportSummary(summary);

      // Result
      BuildResult result = summary.result;
      StdOutReporter.ExitWithResult(result);
    }
  }
}
