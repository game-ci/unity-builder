// These are the packages from Deno that replace the ones from Node.
import * as assert from 'https://deno.land/std@0.142.0/testing/mod.ts';
import * as aws from 'https://deno.land/x/aws_sdk@v3.32.0-1/mod.ts';
import * as compress from 'https://deno.land/x/compress@v0.3.3/mod.ts';
import * as core from 'https://deno.land/x/deno_actions_core/mod.ts';
import * as fs from 'https://deno.land/std@0.142.0/node/fs/promises.ts';
import * as fsSync from 'https://deno.land/std@0.142.0/node/fs/mod.ts';
import * as k8s from 'https://deno.land/x/kubernetes_client/mod.ts';
import * as nanoid from 'https://deno.land/x/nanoid/mod.ts';
import * as path from 'https://deno.land/std@0.142.0/path/mod.ts';
import * as process from 'https://deno.land/std@0.104.0/node/process.ts';
import * as semver from 'https://deno.land/x/semver@v1.4.0/mod.ts';
import * as waitUntil from 'async-wait-until';
import * as yaml from 'https://deno.land/x/yaml@v2.1.1/mod.ts';
import { crypto } from 'https://deno.land/std@0.142.0/crypto/mod.ts';
import { v4 as uuid } from 'https://deno.land/std@0.142.0/uuid/mod.ts';

const exec = () => {
  throw new Error('exec is not implemented'); // @actions/exec'
};

const getUnityChangeSet = () => {
  throw new Error('getUnityChangeSet is not implemented'); // unity-changeset'
};

const waitUntil = async (function_: () => Promise, options = {}) => {
  const { timeout = 10000, interval = 1000 } = options;
  if (timeout || interval) {
    // TODO - do some timeout stuff here
  }

  await function_();
};

class Writable {
  constructor() {
    throw new Error('Writable is not implemented'); // stream
  }
}

const __filename = path.fromFileUrl(import.meta.url);
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

export {
  __dirname,
  __filename,
  assert,
  aws,
  compress,
  core,
  crypto,
  exec,
  fs,
  fsSync,
  getUnityChangeSet,
  k8s,
  nanoid,
  path,
  process,
  semver,
  uuid,
  waitUntil,
  Writable,
  yaml,
};
