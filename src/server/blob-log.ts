// Research log in Azure Blob Storage (production): one JSON blob per record, so several server instances
// can write side by side and the logs come split by school and kid. Uploads run in the background and never
// delay or fail a chat; a record that can't be uploaded goes to the fallback sink (local files) instead.
import crypto from 'node:crypto';
import { DefaultAzureCredential } from '@azure/identity';
import { ContainerClient } from '@azure/storage-blob';
import { type CallContext, type LogSink, prefixHash } from './wire-log.ts';

/** Stores one blob: the Azure SDK in production, a fake in tests. */
export type Upload = (name: string, body: string) => Promise<void>;

export interface BlobLogSink extends LogSink {
  /** waits for the uploads still running (before the server exits) */
  flush(): Promise<void>;
}

/** a safe path segment; the session id comes from a request header */
const segment = (s: string | undefined) => (s ? s.replace(/[^\w-]/g, '_').slice(0, 64) : 'none');

/** calls/<code>/<session>/<turn>-<time>-<random>.json; the random part keeps parallel instances apart */
export const recordBlobName = (kind: 'calls' | 'guard', r: CallContext & { ts: string }): string =>
  `${kind}/${segment(r.accessCode)}/${segment(r.session)}/` +
  `${String(r.turn).padStart(3, '0')}-${r.ts.replace(/:/g, '')}-${crypto.randomUUID().slice(0, 8)}.json`;

export const createBlobLogSink = (upload: Upload, fallback: LogSink): BlobLogSink => {
  const pending = new Set<Promise<void>>();
  const stored = new Set<string>();

  const write = (name: string, body: string, onFailure: () => void) => {
    const p: Promise<void> = upload(name, body)
      .catch((e: unknown) => {
        console.error(
          `research log: upload of ${name} failed, writing it locally:`,
          e instanceof Error ? e.message : e,
        );
        try {
          onFailure();
        } catch (local) {
          console.error('research log: the local fallback failed too:', local);
        }
      })
      .finally(() => pending.delete(p));
    pending.add(p);
  };

  return {
    storePrefix: (prefix) => {
      const hash = prefixHash(prefix);
      if (!stored.has(hash)) {
        stored.add(hash);
        write(`prefixes/${hash}.json`, prefix, () => fallback.storePrefix(prefix));
      }
      return hash;
    },
    append: (record) => write(recordBlobName('calls', record), JSON.stringify(record), () => fallback.append(record)),
    appendGuard: (record) =>
      write(recordBlobName('guard', record), JSON.stringify(record), () => fallback.appendGuard(record)),
    flush: async () => {
      await Promise.allSettled([...pending]);
    },
  };
};

/** Uploads to a container URL with the app's managed identity (locally: the `az login` user). */
export const azureUpload = (containerUrl: string): Upload => {
  const container = new ContainerClient(containerUrl, new DefaultAzureCredential());
  return async (name, body) => {
    await container.getBlockBlobClient(name).upload(body, Buffer.byteLength(body), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });
  };
};
