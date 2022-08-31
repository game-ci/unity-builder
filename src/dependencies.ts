// These are the packages from Deno that replace the ones from Node.
import * as assert from 'https://deno.land/std@0.144.0/testing/asserts.ts';
import * as aws from 'https://deno.land/x/aws_api/client/mod.ts';
import * as base64 from 'https://deno.land/std@0.145.0/encoding/base64.ts';
import * as compress from 'https://deno.land/x/compress@v0.3.3/mod.ts';
import * as fs from 'https://deno.land/std@0.152.0/node/fs/promises.ts';
import * as fsSync from 'https://deno.land/std@0.152.0/fs/mod.ts';
import * as k8s from 'https://deno.land/x/kubernetes_client/mod.ts';
import * as k8sTypes from 'https://deno.land/x/kubernetes_apis/builtin/core@v1/mod.ts';
import * as nanoid from 'https://deno.land/x/nanoid@v3.0.0/mod.ts';
import * as path from 'https://deno.land/std@0.142.0/path/mod.ts';
import * as process from 'https://deno.land/std@0.104.0/node/process.ts';
import * as semver from 'https://deno.land/x/semver@v1.4.0/mod.ts';
import * as yaml from 'https://deno.land/std@0.145.0/encoding/yaml.ts';
import { crypto } from 'https://deno.land/std@0.142.0/crypto/mod.ts';
import { v4 as uuid } from 'https://deno.land/std@0.142.0/uuid/mod.ts';
import * as http from 'https://deno.land/std@0.145.0/node/http.ts';
import * as string from 'https://deno.land/std@0.36.0/strings/mod.ts';
import { Command } from 'https://deno.land/x/cmd@v1.2.0/commander/index.ts';
import { getUnityChangeset as getUnityChangeSet } from 'https://deno.land/x/unity_changeset@2.0.0/src/index.ts';
import { Buffer } from 'https://deno.land/std@0.151.0/io/buffer.ts';
import { config, configSync } from 'https://deno.land/std@0.151.0/dotenv/mod.ts';
import yargs from 'https://deno.land/x/yargs@v17.5.1-deno/deno.ts';
import type { Arguments as YargsArguments } from 'https://deno.land/x/yargs@v17.5.1-deno/deno-types.ts';
import { default as getHomeDir } from 'https://deno.land/x/dir@1.5.1/home_dir/mod.ts';

// Internally managed packages
import waitUntil from './module/wait-until.ts';
import { core } from './module/actions/index.ts';
import { dedent } from './module/dedent.ts';

// Polyfill for https://github.com/tc39/proposal-string-dedent
String.dedent = dedent;

// Errors from yargs can be very verbose and not very descriptive
Error.stackTraceLimit = 15;

class Writable {
  constructor() {
    throw new Error('Writable is not implemented'); // stream
  }
}

const __filename = path.fromFileUrl(import.meta.url);
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

const { V1EnvVar, V1EnvVarSource, V1SecretKeySelector } = k8s;

type YargsInstance = yargs.Argv;

export type { YargsArguments, YargsInstance };
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
  Buffer,
  Command,
  compress,
  config,
  configSync,
  core,
  crypto,
  fs,
  fsSync,
  getHomeDir,
  getUnityChangeSet,
  http,
  nanoid,
  path,
  process,
  semver,
  string,
  uuid,
  waitUntil,
  Writable,
  yaml,
  yargs,
};
