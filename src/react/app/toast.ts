type ToastType = 'ok' | 'error';

function showAppToast(message: string, type: ToastType = 'ok') {
  window.TKFirestoreConnection?.showToast?.(message, type);
}

export { showAppToast };
export type { ToastType };
