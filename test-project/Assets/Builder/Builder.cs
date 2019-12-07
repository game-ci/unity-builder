using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

static class Builder
{
  private static string EOL = Environment.NewLine;
  
  private static void ParseCommandLineArguments(out Dictionary<string, string> providedArguments)
  {
    providedArguments = new Dictionary<string, string>();
    string[] args = Environment.GetCommandLineArgs();

    Console.WriteLine(
      $"{EOL}" +
      $"###########################{EOL}" +
      $"#    Parsing settings     #{EOL}" +
      $"###########################{EOL}" +
      $"{EOL}"
    );

    // Extract flags with optional values
    for (int current = 0, next = 1; current < args.Length; current++, next++) {
      // Parse flag
      bool isFlag = args[current].StartsWith("-");
      if (!isFlag) continue;
      string flag = args[current].TrimStart('-');

      // Parse optional value
      bool flagHasValue = next < args.Length && !args[next].StartsWith("-");
      string value = flagHasValue ? args[next].TrimStart('-') : "";

      // Assign
      Console.WriteLine($"Found flag \"{flag}\" with value \"{value}\".");
      providedArguments.Add(flag, value);
    }
  }

  private static Dictionary<string, string> GetValidatedOptions()
  {
    ParseCommandLineArguments(out var validatedOptions);

    if (!validatedOptions.TryGetValue("projectPath", out var projectPath)) {
      Console.WriteLine("Missing argument -projectPath");
      EditorApplication.Exit(110);
    }

    if (!validatedOptions.TryGetValue("buildTarget", out var buildTarget)) {
      Console.WriteLine("Missing argument -buildTarget");
      EditorApplication.Exit(120);
    }

    if (!Enum.IsDefined(typeof(BuildTarget), buildTarget)) {
      EditorApplication.Exit(121);
    }

    if (!validatedOptions.TryGetValue("customBuildPath", out var customBuildPath)) {
      Console.WriteLine("Missing argument -customBuildPath");
      EditorApplication.Exit(130);
    }

    string defaultCustomBuildName = "TestBuild";
    if (!validatedOptions.TryGetValue("customBuildName", out var customBuildName)) {
      Console.WriteLine($"Missing argument -customBuildName, defaulting to {defaultCustomBuildName}.");
      validatedOptions.Add("customBuildName", defaultCustomBuildName);
    }
    else if (customBuildName == "") {
      Console.WriteLine($"Invalid argument -customBuildName, defaulting to {defaultCustomBuildName}.");
      validatedOptions.Add("customBuildName", defaultCustomBuildName);
    }

    return validatedOptions;
  }

  public static void BuildProject()
  {
    // Gather values from args
    var options = GetValidatedOptions();

    // Gather values from project
    var scenes = EditorBuildSettings.scenes.Where(scene => scene.enabled).Select(s => s.path).ToArray();

    // Define BuildPlayer Options
    var buildOptions = new BuildPlayerOptions {
      scenes = scenes,
      locationPathName = options["customBuildPath"],
      target = (BuildTarget) Enum.Parse(typeof(BuildTarget), options["buildTarget"]),
    };

    // Perform build
    BuildReport buildReport = BuildPipeline.BuildPlayer(buildOptions);

    // Summary
    BuildSummary summary = buildReport.summary;
    ReportSummary(summary);

    // Result
    BuildResult result = summary.result;
    ExitWithResult(result);
  }

  private static void ReportSummary(BuildSummary summary)
  {
    Console.WriteLine(
      $"{EOL}" +
      $"###########################{EOL}" +
      $"#      Build results      #{EOL}" +
      $"###########################{EOL}" +
      $"{EOL}" +
      $"Duration: {summary.totalTime.ToString()}{EOL}" +
      $"Warnings: {summary.totalWarnings.ToString()}{EOL}" +
      $"Errors: {summary.totalErrors.ToString()}{EOL}" +
      $"Size: {summary.totalSize.ToString()} bytes{EOL}" +
      $"{EOL}"
    );
  }

  private static void ExitWithResult(BuildResult result)
  {
    if (result == BuildResult.Succeeded) {
      Console.WriteLine("Build succeeded!");
      EditorApplication.Exit(0);
    }

    if (result == BuildResult.Failed) {
      Console.WriteLine("Build failed!");
      EditorApplication.Exit(101);
    }

    if (result == BuildResult.Cancelled) {
      Console.WriteLine("Build cancelled!");
      EditorApplication.Exit(102);
    }

    if (result == BuildResult.Unknown) {
      Console.WriteLine("Build result is unknown!");
      EditorApplication.Exit(103);
    }
  }
}
