using System;
using UnityEngine;

namespace UnityBuilderAction.Versioning
{
  public static class Git
  {
    const string application = @"git";

    /// <summary>
    /// Generate a version based on the latest tag and the amount of commits.
    /// Format: 0.1.2 (where 2 is the amount of commits).
    ///
    /// If no tag is present in the repository then v0.0 is assumed.
    /// This would result in 0.0.# where # is the amount of commits.
    /// </summary>
    public static string GenerateSemanticCommitVersion()
    {
      string version;
      if (HasAnyVersionTags()) {
        version = GetSemanticCommitVersion();
        Console.WriteLine("Repository has a valid version tag.");
      } else {
        version = $"0.0.{GetTotalNumberOfCommits()}";
        Console.WriteLine("Repository does not have tags to base the version on.");
      }

      Console.WriteLine($"Version is {version}");

      return version;
    }

    /// <summary>
    /// Get the version of the current tag.
    ///
    /// The tag must point at HEAD for this method to work.
    ///
    /// Output Format:
    /// #.* (where # is the major version and * can be any number of any type of character)
    /// </summary>
    public static string GetTagVersion()
    {
      string version = Run(@"tag --points-at HEAD | grep v[0-9]*");

      version = version.Substring(1);

      return version;
    }

    /// <summary>
    /// Get the total number of commits.
    /// </summary>
    static int GetTotalNumberOfCommits()
    {
      string numberOfCommitsAsString = Run(@"git rev-list --count HEAD");

      return int.Parse(numberOfCommitsAsString);
    }

    /// <summary>
    /// Whether or not the repository has any version tags yet.
    /// </summary>
    static bool HasAnyVersionTags()
    {
      return "0" != Run(@"tag --list --merged HEAD | grep v[0-9]* | wc -l");
    }

    /// <summary>
    /// Retrieves the build version from git based on the most recent matching tag and
    /// commit history. This returns the version as: {major.minor.build} where 'build'
    /// represents the nth commit after the tagged commit.
    /// Note: The initial 'v' and the commit hash are removed.
    /// </summary>
    static string GetSemanticCommitVersion()
    {
      // v0.1-2-g12345678 (where 2 is the amount of commits, g stands for git)
      string version = GetVersionString();
      // 0.1-2
      version = version.Substring(1, version.LastIndexOf('-') - 1);
      // 0.1.2
      version = version.Replace('-', '.');

      return version;
    }

    /// <summary>
    /// Get version string.
    ///
    /// Format: `v0.1-2-g12345678` (where 2 is the amount of commits since the last tag)
    ///
    /// See: https://softwareengineering.stackexchange.com/questions/141973/how-do-you-achieve-a-numeric-versioning-scheme-with-git
    /// </summary>
    static string GetVersionString()
    {
      return Run(@"describe --tags --long --match ""v[0-9]*""");

      // Todo - implement split function based on this more complete query
      // return Run(@"describe --long --tags --dirty --always");
    }

    /// <summary>
    /// Runs git binary with any given arguments and returns the output.
    /// </summary>
    static string Run(string arguments)
    {
      using (var process = new System.Diagnostics.Process()) {
        string workingDirectory = UnityEngine.Application.dataPath;

        string output, errors;
        int exitCode = process.Run(application, arguments, workingDirectory, out output, out errors);
        if (exitCode != 0) { throw new GitException(exitCode, errors); }

        return output;
      }
    }
  }
}
