import System from '../system';

export class AWSTokenReader {
  public static async GetAWSTokenFromCLI() {
    return JSON.parse(await System.run(`aws sts get-session-token`)).Credentials.SessionToken;
  }
}
