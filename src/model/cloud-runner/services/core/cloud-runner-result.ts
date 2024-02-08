import BuildParameters from '../../../build-parameters';

class CloudRunnerResult {
  public BuildParameters: BuildParameters;
  public BuildResults: string;
  public BuildSucceeded: boolean;
  public BuildFinished: boolean;
  public LibraryCacheUsed: boolean;

  public constructor(
    buildParameters: BuildParameters,
    buildResults: string,
    buildSucceeded: boolean,
    buildFinished: boolean,
    libraryCacheUsed: boolean,
  ) {
    this.BuildParameters = buildParameters;
    this.BuildResults = buildResults;
    this.BuildSucceeded = buildSucceeded;
    this.BuildFinished = buildFinished;
    this.LibraryCacheUsed = libraryCacheUsed;
  }
}
export default CloudRunnerResult;
