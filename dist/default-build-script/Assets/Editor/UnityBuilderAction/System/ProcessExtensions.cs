using System.Diagnostics;
using System.Text;

public static class ProcessExtensions
{
  // Execute an application or binary with given arguments
  //
  // See: https://stackoverflow.com/questions/4291912/process-start-how-to-get-the-output
  public static int Run(this Process process, string application,
    string arguments, string workingDirectory, out string output,
    out string errors)
  {
    // Configure how to run the application
    process.StartInfo = new ProcessStartInfo {
      CreateNoWindow = true,
      UseShellExecute = false,
      RedirectStandardError = true,
      RedirectStandardOutput = true,
      FileName = application,
      Arguments = arguments,
      WorkingDirectory = workingDirectory
    };

    // Read the output
    var outputBuilder = new StringBuilder();
    var errorsBuilder = new StringBuilder();
    process.OutputDataReceived += (_, args) => outputBuilder.AppendLine(args.Data);
    process.ErrorDataReceived += (_, args) => errorsBuilder.AppendLine(args.Data);

    // Run the application and wait for it to complete
    process.Start();
    process.BeginOutputReadLine();
    process.BeginErrorReadLine();
    process.WaitForExit();

    // Format the output
    output = outputBuilder.ToString().TrimEnd();
    errors = errorsBuilder.ToString().TrimEnd();

    return process.ExitCode;
  }
}
