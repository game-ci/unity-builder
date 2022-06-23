// These are the packages from Deno that replace the ones from Node.
import * as assert from 'https://deno.land/std@0.144.0/testing/asserts.ts';
import * as aws from 'https://deno.land/x/aws_api/client/mod.ts';
import * as base64 from 'https://deno.land/std@0.145.0/encoding/base64.ts';
import * as compress from 'https://deno.land/x/compress@v0.3.3/mod.ts';
// import * as core from 'https://deno.land/x/deno_actions_core@0.1.3/mod.ts';
import * as fs from 'https://deno.land/std@0.142.0/node/fs/promises.ts';
import * as fsSync from 'https://deno.land/std@0.142.0/fs/mod.ts';
import * as k8s from 'https://deno.land/x/kubernetes_client/mod.ts';
import * as k8sTypes from 'https://deno.land/x/kubernetes_apis/builtin/core@v1/mod.ts';
import * as nanoid from 'https://deno.land/x/nanoid@v3.0.0/mod.ts';
import * as path from 'https://deno.land/std@0.142.0/path/mod.ts';
import * as process from 'https://deno.land/std@0.104.0/node/process.ts';
import * as semver from 'https://deno.land/x/semver@v1.4.0/mod.ts';
import * as waitUntil from './helpers/waitUntil.ts';
import * as yaml from 'https://deno.land/std@0.145.0/encoding/yaml.ts';
import { crypto } from 'https://deno.land/std@0.142.0/crypto/mod.ts';
import { v4 as uuid } from 'https://deno.land/std@0.142.0/uuid/mod.ts';
import * as http from 'https://deno.land/std@0.145.0/node/http.ts';
import { Command } from 'https://deno.land/x/cmd@v1.2.0/commander/index.ts';

const core = {
  info: console.log,
  error: (error) => console.error(error, error.stack),
  setFailed: (failure) => console.error('setFailed:', failure),

  // Adapted from: https://github.com/actions/toolkit/blob/9b7bcb1567c9b7f134eb3c2d6bbf409a5106a956/packages/core/src/core.ts#L128
  getInput: (name, options) => {
    const val: string = Deno.env.get(`INPUT_${name.replace(/ /g, '_').toUpperCase()}`) || '';

    if (options?.required && !val) {
      throw new Error(`Input required and not supplied: ${name}`);
    }

    if (options && options.trimWhitespace === false) {
      return val;
    }

    return val.trim();
  },
};

const exec = () => {
  throw new Error('exec is not implemented'); // @actions/exec'
};

const getUnityChangeSet = () => {
  throw new Error('getUnityChangeSet is not implemented'); // unity-changeset'
};

class Writable {
  constructor() {
    throw new Error('Writable is not implemented'); // stream
  }
}

// class Command {
//   constructor() {
//     throw new Error('Command is not implemented'); // commander-ts
//   }
// }

const __filename = path.fromFileUrl(import.meta.url);
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

const { V1EnvVar, V1EnvVarSource, V1SecretKeySelector } = k8s;

export {
  __dirname,
  __filename,
  k8s,
  k8sTypes,
  V1EnvVar,
  V1EnvVarSource,
  V1SecretKeySelector,
  assert,
  aws,
  base64,
  Command,
  compress,
  core,
  crypto,
  exec,
  fs,
  fsSync,
  getUnityChangeSet,
  http,
  nanoid,
  path,
  process,
  semver,
  uuid,
  waitUntil,
  Writable,
  yaml,
};
