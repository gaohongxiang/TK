import { TKAnalyticsAnalyzer } from '../../../analytics/analyzer.ts';
import { TKAnalyticsParser } from '../../../analytics/parser.ts';
import { TKFirestoreConnection } from '../../../firestore-connection.ts';
import { AnalyticsApp } from './AnalyticsApp';
import type { AnalyticsXlsx } from '../../../analytics/types';

declare global {
  interface Window {
    XLSX?: AnalyticsXlsx;
  }
}

function AnalyticsRoute() {
  return (
    <AnalyticsApp
      analyzer={TKAnalyticsAnalyzer}
      parser={TKAnalyticsParser}
      getXlsx={() => window.XLSX}
      onToast={(message, type) => TKFirestoreConnection.showToast(message, type)}
    />
  );
}

export { AnalyticsRoute };
