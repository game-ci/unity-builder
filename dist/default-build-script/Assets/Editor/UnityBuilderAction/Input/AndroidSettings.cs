using System;
using System.Collections.Generic;
using UnityEditor;

namespace UnityBuilderAction.Input
{
  public class AndroidSettings
  {
    public static void Apply(Dictionary<string, string> options)
    {
#if UNITY_2019_1_OR_NEWER
      if (options.TryGetValue("androidKeystoreName", out string keystoreName) && !string.IsNullOrEmpty(keystoreName))
      {
        PlayerSettings.Android.useCustomKeystore = true;
        PlayerSettings.Android.keystoreName = keystoreName;
      }
#endif
      if (options.TryGetValue("androidKeystorePass", out string keystorePass) && !string.IsNullOrEmpty(keystorePass))
        PlayerSettings.Android.keystorePass = keystorePass;
      if (options.TryGetValue("androidKeyaliasName", out string keyaliasName) && !string.IsNullOrEmpty(keyaliasName))
        PlayerSettings.Android.keyaliasName = keyaliasName;
      if (options.TryGetValue("androidKeyaliasPass", out string keyaliasPass) && !string.IsNullOrEmpty(keyaliasPass))
        PlayerSettings.Android.keyaliasPass = keyaliasPass;
      if (options.TryGetValue("androidTargetSdkVersion", out string androidTargetSdkVersion) && !string.IsNullOrEmpty(androidTargetSdkVersion))
      {
          var targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;
          try
          {
              targetSdkVersion =
                  (AndroidSdkVersions) Enum.Parse(typeof(AndroidSdkVersions), androidTargetSdkVersion);
          }
          catch
          {
              UnityEngine.Debug.Log("Failed to parse androidTargetSdkVersion! Fallback to AndroidApiLevelAuto");
          }
          PlayerSettings.Android.targetSdkVersion = targetSdkVersion;
      }

      if (options.TryGetValue("androidExportType", out string androidExportType) && !string.IsNullOrEmpty(androidExportType))
      {
        switch (androidExportType)
        {
          case "androidStudioProject":
            EditorUserBuildSettings.exportAsGoogleAndroidProject = true;
            EditorUserBuildSettings.buildAppBundle = false;
            break;
          case "androidAppBundle":
            EditorUserBuildSettings.buildAppBundle = true;
            EditorUserBuildSettings.exportAsGoogleAndroidProject = false;
            break;
          default:
            EditorUserBuildSettings.exportAsGoogleAndroidProject = false;
            EditorUserBuildSettings.buildAppBundle = false;
            break;
        }
      }

      if (options.TryGetValue("androidSymbolType", out string symbolType) && !string.IsNullOrEmpty(symbolType))
      {
        switch(symbolType)
        {
          case "public":
            EditorUserBuildSettings.androidCreateSymbols = AndroidCreateSymbols.Public;
            break;
          case "debugging":
            EditorUserBuildSettings.androidCreateSymbols = AndroidCreateSymbols.Debugging;
            break;
          case "none":
            EditorUserBuildSettings.androidCreateSymbols = AndroidCreateSymbols.Disabled;
            break;
        }
      }
    }
  }
}
