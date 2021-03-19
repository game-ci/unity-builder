using System;
using UnityEditor;
using UnityEditor.Build.Reporting;

namespace UnityBuilderAction.Reporting
{
  public class StdOutReporter
  {
    static string EOL = Environment.NewLine;

    public static void ReportSummary(BuildSummary summary)
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

    public static void ExitWithResult(BuildResult result)
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
}
