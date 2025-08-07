import { fetch as undiciFetch, Headers, Request, Response } from 'undici';

Object.assign(globalThis, { fetch: undiciFetch, Headers, Request, Response });
