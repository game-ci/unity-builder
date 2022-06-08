// These are the packages from Deno that replace the ones from Node.
import * as fs from 'https://deno.land/std@0.142.0/node/fs/promises.ts';
import * as fsSync from 'https://deno.land/std@0.142.0/node/fs/mod.ts';
import * as path from 'https://deno.land/std@0.142.0/path/mod.ts';
import * as core from 'https://deno.land/x/deno_actions_core/mod.ts';
import { v4 as uuid } from 'https://deno.land/std@0.142.0/uuid/mod.ts';
import * as assert from 'https://deno.land/std@0.142.0/testing/mod.ts';
import * as YAML from 'https://deno.land/x/yaml@v2.1.1/mod.ts';
import * as aws from 'https://deno.land/x/aws_sdk@v3.32.0-1/mod.ts';
import * as k8s from 'https://deno.land/x/kubernetes_client/mod.ts';
import * as nanoid from 'https://deno.land/x/nanoid/mod.ts';

const exec = () => {
  throw new Error('exec is not implemented'); // @actions/exec'
};

const getUnityChangeSet = () => {
  throw new Error('getUnityChangeSet is not implemented'); // unity-changeset'
};

const __filename = path.fromFileUrl(import.meta.url);
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

export { fs, fsSync, path, core, exec, uuid, assert, YAML, __filename, __dirname, getUnityChangeSet, aws, k8s, nanoid };
