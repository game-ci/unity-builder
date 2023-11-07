using UnityEngine;
using UnityEditor;

namespace UnityBuilderAction.Reporting
{
    [InitializeOnLoad]
    static class CompileListener
    {
        static CompileListener()
        {
            if (Application.isBatchMode)
            {
                Application.logMessageReceived += Application_logMessageReceived;
            }
        }

        private static void Application_logMessageReceived(string condition, string stackTrace, LogType type)
        {
            string prefix = "";
            switch (type)
            {
                case LogType.Error:
                    prefix = "error";
                    break;
                case LogType.Warning:
                    prefix = "warning";
                    break;
            }
            Debug.Log($"::{prefix} ::{condition}\n{stackTrace}");
        }
    }
}
