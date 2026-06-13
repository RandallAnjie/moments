// Defensive R2Bucket shim for self-hosted edge planes that pass R2 as a
// raw Service Binding (a Fetcher) plus a `<NAME>_ID` text binding.
//
// Background: workerd's Service Binding RPC semantics treat every
// property access as an RPC method call. If the host plane forgets to
// wrap a Service Binding into an R2Bucket-shape before handing it to
// user code, `env.UPLOADS.put(key, data)` ends up as a workerd RPC
// `fetch(key)` — and since `key` is not a valid URL, workerd throws
// `Fetch API cannot load: <key>`. The bigrandall plane has an
// auto-wrap, but downstream env spread inside Nuxt's `cloudflare-pages`
// preset has historically been able to drop wrapped instances back
// to the raw Fetcher. This file is moments' belt-and-suspenders: if
// we see a Fetcher + `<NAME>_ID` text binding, we wrap on this side
// too. Real Cloudflare Pages doesn't ship a `<NAME>_ID`, so we leave
// the binding alone there.

type R2HttpMetadata = {
  contentType?: string;
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  contentLanguage?: string;
};

type R2PutOptions = {
  httpMetadata?: R2HttpMetadata;
  customMetadata?: Record<string, string>;
};

type R2ListOptions = {
  prefix?: string;
  cursor?: string;
  limit?: number;
};

type Fetcher = {
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
};

/**
 * Subset of R2Object we actually use in this app (body access + headers).
 */
class R2Object {
  readonly key: string;
  private readonly _resp: Response;
  constructor(key: string, resp: Response) {
    this.key = key;
    this._resp = resp;
  }
  get body(): ReadableStream<Uint8Array> | null {
    return this._resp.body;
  }
  get httpEtag(): string | null {
    return this._resp.headers.get("etag");
  }
  arrayBuffer(): Promise<ArrayBuffer> {
    return this._resp.arrayBuffer();
  }
  text(): Promise<string> {
    return this._resp.text();
  }
  blob(): Promise<Blob> {
    return this._resp.blob();
  }
}

/**
 * Plane-compatible R2Bucket shim. Constructed lazily inside cf-env.ts
 * when we detect a raw Fetcher service binding alongside a `_ID` text
 * binding. Mirrors only the methods this app actually uses.
 */
class R2BucketShim {
  private readonly _svc: Fetcher;
  private readonly _id: string;
  /** Marker so getCfEnv can recognise an already-wrapped binding and
   *  avoid double-wrapping. */
  readonly __r2ShimWrapped = true;

  constructor(svc: Fetcher, id: string) {
    this._svc = svc;
    this._id = id;
  }

  async get(key: string): Promise<R2Object | null> {
    if (typeof key !== "string" || key.length === 0) {
      throw new Error("R2.get: key must be a non-empty string");
    }
    const r = await this._objectFetch("GET", key);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`R2 get ${r.status}`);
    return new R2Object(key, r);
  }

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | Blob | string,
    options?: R2PutOptions,
  ): Promise<{ key: string; etag: string | null; size: number | null }> {
    if (typeof key !== "string" || key.length === 0) {
      throw new Error("R2.put: key must be a non-empty string");
    }
    const headers: Record<string, string> = {};
    if (options?.httpMetadata) {
      const m = options.httpMetadata;
      if (m.contentType) headers["content-type"] = m.contentType;
      if (m.cacheControl) headers["cache-control"] = m.cacheControl;
      if (m.contentDisposition) headers["content-disposition"] = m.contentDisposition;
      if (m.contentEncoding) headers["content-encoding"] = m.contentEncoding;
      if (m.contentLanguage) headers["content-language"] = m.contentLanguage;
    }
    if (options?.customMetadata) {
      for (const [k, v] of Object.entries(options.customMetadata)) {
        headers[`x-amz-meta-${k.toLowerCase()}`] = String(v);
      }
    }
    const r = await this._objectFetch("PUT", key, value, headers);
    if (!r.ok) throw new Error(`R2 put ${r.status}`);
    const body = (await r.json().catch(() => ({}))) as {
      etag?: string;
      size?: number;
    };
    return {
      key,
      etag: body.etag ?? null,
      size: body.size ?? null,
    };
  }

  async delete(key: string): Promise<void> {
    const r = await this._objectFetch("DELETE", key);
    if (!r.ok && r.status !== 404) throw new Error(`R2 delete ${r.status}`);
  }

  async list(options?: R2ListOptions): Promise<unknown> {
    const q = new URLSearchParams();
    if (options?.prefix) q.set("prefix", options.prefix);
    if (options?.cursor) q.set("cursor", options.cursor);
    if (options?.limit != null) q.set("limit", String(options.limit));
    const url = `http://r2proxy/v1/list/${encodeURIComponent(this._id)}?${q.toString()}`;
    const r = await this._svc.fetch(url);
    if (!r.ok) throw new Error(`R2 list ${r.status}`);
    return await r.json();
  }

  private async _objectFetch(
    method: string,
    key: string,
    body?: BodyInit | ArrayBuffer | ArrayBufferView,
    headers?: Record<string, string>,
  ): Promise<Response> {
    const encKey = key.split("/").map(encodeURIComponent).join("/");
    const url = `http://r2proxy/v1/objects/${encodeURIComponent(this._id)}/${encKey}`;
    const init: RequestInit = { method };
    if (body !== undefined) init.body = body as BodyInit;
    if (headers) init.headers = headers;
    try {
      return await this._svc.fetch(url, init);
    } catch (e) {
      const orig = e instanceof Error ? e.message : String(e);
      throw new Error(`R2 shim ${method} ${url} failed: ${orig}`);
    }
  }
}

/**
 * Detect a raw Service Binding and wrap it if a sibling `_ID` text
 * binding is present. Idempotent: returns the binding unchanged if
 * it's already a wrapped instance OR if `_ID` is missing (real CF
 * Pages path).
 */
export function maybeWrapR2(
  binding: unknown,
  id: string | undefined,
): unknown {
  if (!binding) return binding;
  // Already wrapped — our marker survives spread, plane shim's
  // marker would too if they had one. Either way, return as-is.
  if ((binding as { __r2ShimWrapped?: boolean }).__r2ShimWrapped) {
    return binding;
  }
  // No `_ID` text binding means we're on real CF Pages — the
  // binding is already a real R2Bucket, hands off.
  if (!id) return binding;
  // Has `.fetch` but appears to be raw Fetcher (no real `.put`
  // semantics — workerd raw service bindings still respond to
  // arbitrary property access, so we don't try to feature-detect
  // `.put`; the `_ID` presence is signal enough).
  const f = binding as Fetcher;
  if (typeof f.fetch !== "function") return binding;
  return new R2BucketShim(f, id);
}

export type { R2BucketShim };
