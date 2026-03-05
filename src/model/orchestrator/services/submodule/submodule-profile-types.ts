export interface SubmoduleEntry {
  name: string;
  branch: string;
}

export interface SubmoduleProfile {
  primary_submodule?: string;
  product_name?: string;
  submodules: SubmoduleEntry[];
}

export interface SubmoduleInitAction {
  name: string;
  path: string;
  branch: string;
  action: 'init' | 'skip';
}

export type SubmoduleInitPlan = SubmoduleInitAction[];
