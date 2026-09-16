import * as ort from 'onnxruntime-web';
import metadata from '../../../public/models/model_metadata.json';

/** Embedded identity pins this application build to one verified model export. */
export const MODEL_METADATA = metadata;

export function validateModelMetadata(value: unknown): void {
  const actual = value as typeof metadata;
  if (actual?.schema_version !== 2 || actual?.conditioning?.mode !== 'meter' ||
      actual?.conditioning?.input_name !== 'meter' || actual?.conditioning?.null_value !== 0 ||
      actual?.conditioning?.category_role !== 'metadata_only' ||
      actual?.checkpoint_sha256 !== metadata.checkpoint_sha256 ||
      actual?.model_id !== metadata.model_id || !actual?.parity?.verified) {
    throw new Error('Model metadata does not match this numeric-meter application build');
  }
  for (const name of ['stepper_placement.onnx', 'stepper_decoder.onnx'] as const) {
    if (actual.files?.[name]?.sha256 !== metadata.files[name].sha256) {
      throw new Error(`Model metadata checksum mismatch: ${name}`);
    }
  }
}

export function versionedModelUrl(url: string, name: keyof typeof metadata.files): string {
  const versioned = new URL(url);
  versioned.searchParams.set('sha256', metadata.files[name].sha256);
  return versioned.href;
}

let manifestPromise: Promise<void> | null = null;
export async function loadVerifiedModel(url: string, name: keyof typeof metadata.files): Promise<string | Uint8Array> {
  validateModelMetadata(metadata);
  // ONNX Runtime's Node test adapter reads local paths. Browser assets are
  // checked against both the deployed manifest and the embedded SHA-256.
  if (typeof globalThis.process !== 'undefined' && globalThis.process.versions?.node) return url;
  manifestPromise ??= fetch(new URL('model_metadata.json', url), { cache: 'no-cache' }).then(async response => {
    if (!response.ok) throw new Error('Cannot load model metadata');
    validateModelMetadata(await response.json());
  });
  await manifestPromise;
  const response = await fetch(versionedModelUrl(url, name));
  if (!response.ok) throw new Error(`Cannot load model: ${name}`);
  const bytes = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  if (sha256 !== metadata.files[name].sha256) throw new Error(`Model checksum mismatch: ${name}`);
  return new Uint8Array(bytes);
}

export async function createVerifiedSession(url: string, name: keyof typeof metadata.files, options: ort.InferenceSession.SessionOptions) {
  const source = await loadVerifiedModel(url, name);
  return typeof source === 'string' ? ort.InferenceSession.create(source, options) : ort.InferenceSession.create(source, options);
}
