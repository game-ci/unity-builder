using System;
using System.Linq;
using System.Reflection;
using UnityBuilderAction.Input;
using UnityBuilderAction.Reporting;
using UnityBuilderAction.Versioning;
using UnityEditor;
using UnityEditor.Build.Reporting;
#if UNITY_6000_0_OR_NEWER
using UnityEditor.Build.Profile;
#endif
using UnityEngine;

namespace UnityBuilderAction
{
  static class Builder
  {
    public static void BuildProject()
    {
      // Gather values from args
      var options = ArgumentsParser.GetValidatedOptions();

      // Set version for this build
      VersionApplicator.SetVersion(options["buildVersion"]);

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
          Debug.LogError("Failed to run default addressables build:\n" + e);
        }
      }

      // Get all buildOptions from options
      BuildOptions buildOptions = BuildOptions.None;
      foreach (string buildOptionString in Enum.GetNames(typeof(BuildOptions))) {
        if (options.ContainsKey(buildOptionString)) {
          BuildOptions buildOptionEnum = (BuildOptions) Enum.Parse(typeof(BuildOptions), buildOptionString);
          buildOptions |= buildOptionEnum;
        }
      }

      // Depending on whether the build is using a build profile, `buildPlayerOptions` will an instance
      // of either `UnityEditor.BuildPlayerOptions` or `UnityEditor.BuildPlayerWithProfileOptions`
      dynamic buildPlayerOptions;

      if (options["customBuildProfile"] != "") {

#if UNITY_6000_0_OR_NEWER
        // Load build profile from Assets folder
        BuildProfile buildProfile = AssetDatabase.LoadAssetAtPath<BuildProfile>(options["customBuildProfile"]);

        // Set it as active
        BuildProfile.SetActiveBuildProfile(buildProfile);

        // Define BuildPlayerWithProfileOptions
        buildPlayerOptions = new BuildPlayerWithProfileOptions {
            buildProfile = buildProfile,
            locationPathName = options["customBuildPath"],
            options = buildOptions,
        };
#else
        throw new Exception("Build profiles are not supported by this version of Unity (" + Application.unityVersion +")");
#endif

      } else {

        // Gather values from project
        var scenes = EditorBuildSettings.scenes.Where(scene => scene.enabled).Select(s => s.path).ToArray();

#if UNITY_2021_2_OR_NEWER
        // Determine subtarget
        StandaloneBuildSubtarget buildSubtarget;
        if (!options.TryGetValue("standaloneBuildSubtarget", out var subtargetValue) || !Enum.TryParse(subtargetValue, out buildSubtarget)) {
          buildSubtarget = default;
        }
#endif

        BuildTarget buildTarget = (BuildTarget) Enum.Parse(typeof(BuildTarget), options["buildTarget"]);

        // Define BuildPlayerOptions
        buildPlayerOptions = new BuildPlayerOptions {
          scenes = scenes,
          locationPathName = options["customBuildPath"],
          target = buildTarget,
          options = buildOptions,
#if UNITY_2021_2_OR_NEWER
          subtarget = (int) buildSubtarget
#endif
        };

        // Apply Android settings
        if (buildTarget == BuildTarget.Android) {
          VersionApplicator.SetAndroidVersionCode(options["androidVersionCode"]);
          AndroidSettings.Apply(options);
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
