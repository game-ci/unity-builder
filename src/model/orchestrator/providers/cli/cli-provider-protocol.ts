export interface CliProviderRequest {
  command: CliProviderSubcommand;
  params: Record<string, any>;
}

export interface CliProviderResponse {
  success: boolean;
  result?: any;
  error?: string;
  output?: string;
}

export type CliProviderSubcommand =
  | 'setup-workflow'
  | 'cleanup-workflow'
  | 'run-task'
  | 'garbage-collect'
  | 'list-resources'
  | 'list-workflow'
  | 'watch-workflow';
