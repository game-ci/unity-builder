using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;

namespace UnityBuilderAction.Input
{
  public class ArgumentsParser
  {
    static string EOL = Environment.NewLine;
    static readonly string[] Secrets = { "androidKeystorePass", "androidKeyaliasName", "androidKeyaliasPass" };

    public static Dictionary<string, string> GetValidatedOptions()
    {
      Dictionary<string, string> validatedOptions;
      ParseCommandLineArguments(out validatedOptions);

      string projectPath;
      if (!validatedOptions.TryGetValue("projectPath", out projectPath)) {
        Console.WriteLine("Missing argument -projectPath");
        EditorApplication.Exit(110);
      }

      string buildTarget;
      if (!validatedOptions.TryGetValue("buildTarget", out buildTarget)) {
        Console.WriteLine("Missing argument -buildTarget");
        EditorApplication.Exit(120);
      }

      if (!Enum.IsDefined(typeof(BuildTarget), buildTarget)) {
        Console.WriteLine($"{buildTarget} is not a defined {nameof(BuildTarget)}");
        EditorApplication.Exit(121);
      }

      string customBuildPath;
      if (!validatedOptions.TryGetValue("customBuildPath", out customBuildPath)) {
        Console.WriteLine("Missing argument -customBuildPath");
        EditorApplication.Exit(130);
      }

      const string defaultCustomBuildName = "TestBuild";
      string customBuildName;
      if (!validatedOptions.TryGetValue("customBuildName", out customBuildName)) {
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
        bool secret = Secrets.Contains(flag);
        string displayValue = secret ? "*HIDDEN*" : "\"" + value + "\"";

        // Assign
        Console.WriteLine($"Found flag \"{flag}\" with value {displayValue}.");
        providedArguments.Add(flag, value);
      }
    }
  }
}
