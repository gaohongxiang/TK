import { TKFirestoreConnection } from '../../firestore-connection.mjs';

type ToastType = 'ok' | 'error';

function showAppToast(message: string, type: ToastType = 'ok') {
  TKFirestoreConnection.showToast(message, type);
}

export { showAppToast };
export type { ToastType };
