using System;
using System.Collections.Generic;
using System.Linq;
using UnityBuilderAction.Input;
using UnityBuilderAction.Reporting;
using UnityBuilderAction.Versioning;
using UnityEditor;
using UnityEditor.Build.Reporting;

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
