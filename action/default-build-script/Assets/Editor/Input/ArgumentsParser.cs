using System;
using System.Collections.Generic;
using UnityEditor;

namespace UnityBuilderAction.Input
{
  public class ArgumentsParser
  {
    static string EOL = Environment.NewLine;

    public static Dictionary<string, string> GetValidatedOptions()
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

      const string defaultCustomBuildName = "TestBuild";
      if (!validatedOptions.TryGetValue("customBuildName", out var customBuildName)) {
        Console.WriteLine($"Missing argument -customBuildName, defaulting to {defaultCustomBuildName}.");
        validatedOptions.Add("customBuildName", defaultCustomBuildName);
      } else if (customBuildName == "") {
        Console.WriteLine($"Invalid argument -customBuildName, defaulting to {defaultCustomBuildName}.");
        validatedOptions.Add("customBuildName", defaultCustomBuildName);
      }

      return validatedOptions;
    }

    static void ParseCommandLineArguments(out Dictionary<string, string> providedArguments)
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
  }
}
