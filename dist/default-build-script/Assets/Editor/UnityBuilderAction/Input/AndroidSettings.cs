using System;
using System.Collections.Generic;
using UnityEditor;

namespace UnityBuilderAction.Input
{
  public class AndroidSettings
  {
    public static void Apply(Dictionary<string, string> options)
    {
      if (options.TryGetValue("androidAppBundle", out string androidAppBundle) || options["customBuildPath"].EndsWith(".aab"))
      {
        EditorUserBuildSettings.buildAppBundle = androidAppBundle == "true" || androidAppBundle == string.Empty || options["customBuildPath"].EndsWith(".aab";

        Console.WriteLine("Set Android App Bundle: " + EditorUserBuildSettings.buildAppBundle);
      }
      else
      {
        EditorUserBuildSettings.buildAppBundle = false;
      }

      if (options.TryGetValue("exportAsGoogleAndroidProject", out string exportAsGoogleAndroidProject))
      {
        EditorUserBuildSettings.exportAsGoogleAndroidProject = exportAsGoogleAndroidProject == "true" || exportAsGoogleAndroidProject == string.Empty;
        Console.WriteLine("Set Export as Google Project: " + EditorUserBuildSettings.exportAsGoogleAndroidProject);
      }
      else
      {
        EditorUserBuildSettings.exportAsGoogleAndroidProject = false;
      }

      if (options.TryGetValue("androidKeystoreName", out string keystoreName) && !string.IsNullOrEmpty(keystoreName))
      {
        PlayerSettings.Android.useCustomKeystore = true;
        PlayerSettings.Android.keystoreName = keystoreName;
      }
      if (options.TryGetValue("androidKeystorePass", out string keystorePass) && !string.IsNullOrEmpty(keystorePass))
        PlayerSettings.Android.keystorePass = keystorePass;
      if (options.TryGetValue("androidKeyaliasName", out string keyaliasName) && !string.IsNullOrEmpty(keyaliasName))
        PlayerSettings.Android.keyaliasName = keyaliasName;
      if (options.TryGetValue("androidKeyaliasPass", out string keyaliasPass) && !string.IsNullOrEmpty(keyaliasPass))
        PlayerSettings.Android.keyaliasPass = keyaliasPass;
      if (options.TryGetValue("androidTargetSdkVersion", out string androidTargetSdkVersion) && !string.IsNullOrEmpty(androidTargetSdkVersion))
        PlayerSettings.Android.targetSdkVersion = (AndroidSdkVersions) Enum.Parse(typeof(AndroidSdkVersions), androidTargetSdkVersion);
    }
  }
}
