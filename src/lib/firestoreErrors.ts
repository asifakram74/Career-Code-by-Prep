import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export const FIRESTORE_UPGRADE_URL =
  'https://console.firebase.google.com/project/double-pilot-fw1xt/firestore/databases/ai-studio-careerguidebypre-f57db027-f698-4527-9c06-b5d6f9eeabe2/data?openUpgradeDialog=true';

type QuotaListener = (exceeded: boolean, info?: FirestoreErrorInfo) => void;
const quotaListeners = new Set<QuotaListener>();
let quotaExceededState = false;

export function isQuotaExceeded(): boolean {
  return quotaExceededState;
}

export function subscribeToQuotaExceeded(listener: QuotaListener): () => void {
  quotaListeners.add(listener);
  if (quotaExceededState) {
    listener(true);
  }
  return () => {
    quotaListeners.delete(listener);
  };
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code;
  return (
    code === 'resource-exhausted' ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('resource-exhausted') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Free daily read units per project') ||
    msg.includes('quota metric')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const current = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: current?.uid,
      email: current?.email,
      emailVerified: current?.emailVerified,
      isAnonymous: current?.isAnonymous,
      tenantId: current?.tenantId,
      providerInfo: current?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };

  if (isQuotaExceededError(error)) {
    quotaExceededState = true;
    quotaListeners.forEach((fn) => {
      try {
        fn(true, errInfo);
      } catch {}
    });
    console.warn(
      `[Firestore Quota Limit] Daily read quota reached for path "${path}" (${operationType}). Serving cached data. Upgrade link: ${FIRESTORE_UPGRADE_URL}`
    );
    return;
  }

  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
