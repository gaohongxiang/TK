import type { AnalyticsXlsx } from '../analytics/types.ts';
import type { FirebaseCompatNamespace } from './firestore.ts';

declare global {
  interface Window {
    firebase?: FirebaseCompatNamespace;
    XLSX?: AnalyticsXlsx;
  }
}

export {};
