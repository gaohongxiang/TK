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
  }
}`;

if (typeof window !== 'undefined') {
  window.ORDER_TRACKER_FIRESTORE_RULES = ORDER_TRACKER_FIRESTORE_RULES;
}

export {
  ORDER_TRACKER_FIRESTORE_RULES
};
