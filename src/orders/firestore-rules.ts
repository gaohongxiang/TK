const ORDER_TRACKER_FIRESTORE_RULES = String.raw`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /orders/{orderId} {
      allow read, write: if true;
    }

    match /order_accounts/{accountId} {
      allow read, write: if true;
    }

    match /sync_state/{scope} {
      allow read, write: if true;
    }

    match /products/{productId} {
      allow read, write: if true;
    }

    match /finance_records/{recordId} {
      allow read, write: if true;
    }

    match /collection_records/{productKey} {
      allow read, write: if true;
    }

    match /collection_excluded_products/{productKey} {
      allow read, write: if true;
    }

    match /analytics_snapshots/{snapshotId} {
      allow read, write: if true;
    }

    match /analytics_records/{recordId} {
      allow read, write: if true;
    }

    match /_tk_probe/{probeId} {
      allow read, write: if true;
    }
  }
}`;

export {
  ORDER_TRACKER_FIRESTORE_RULES
};
