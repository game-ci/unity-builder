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
      // Can't use out variable declaration as Unity 2018 doesn't support it
      string keystorePass;
      if (options.TryGetValue("androidKeystorePass", out keystorePass) && !string.IsNullOrEmpty(keystorePass))
        PlayerSettings.Android.keystorePass = keystorePass;
      
      string keyAliasName;
      if (options.TryGetValue("androidKeyaliasName", out keyaliasName) && !string.IsNullOrEmpty(keyaliasName))
        PlayerSettings.Android.keyaliasName = keyaliasName;

      string keyaliasPass;
      if (options.TryGetValue("androidKeyaliasPass", out keyaliasPass) && !string.IsNullOrEmpty(keyaliasPass))
        PlayerSettings.Android.keyaliasPass = keyaliasPass;
      
      string androidTargetSdkVersion;
      if (options.TryGetValue("androidTargetSdkVersion", out androidTargetSdkVersion) && !string.IsNullOrEmpty(androidTargetSdkVersion))
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

      string androidExportType;
      if (options.TryGetValue("androidExportType", out androidExportType) && !string.IsNullOrEmpty(androidExportType))
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

      string symbolType;
      if (options.TryGetValue("androidSymbolType", out symbolType) && !string.IsNullOrEmpty(symbolType))
      {
#if UNITY_2021_1_OR_NEWER
        switch (symbolType)
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
#elif UNITY_2019_2_OR_NEWER
        switch (symbolType)
        {
          case "public":
          case "debugging":
            EditorUserBuildSettings.androidCreateSymbolsZip = true;
            break;
          case "none":
            EditorUserBuildSettings.androidCreateSymbolsZip = false;
            break;
        }
#endif
      }
    }
  }
}
