import { TKAnalyticsAnalyzer } from '../../../analytics/analyzer.mjs';
import { TKAnalyticsParser } from '../../../analytics/parser.mjs';
import { TKFirestoreConnection } from '../../../firestore-connection.mjs';
import { AnalyticsApp } from './AnalyticsApp';

declare global {
  interface Window {
    XLSX?: any;
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
