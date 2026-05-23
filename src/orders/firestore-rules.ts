const ORDER_TRACKER_FIRESTORE_RULES = String.raw`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null && request.auth.token.email != null;
    }

    function memberDoc() {
      return get(/databases/$(database)/documents/members/$(request.auth.token.email.lower()));
    }

    function isMember() {
      return signedIn() && exists(/databases/$(database)/documents/members/$(request.auth.token.email.lower()));
    }

    function isOwner() {
      return isMember() && memberDoc().data.role == 'owner';
    }

    function canUse(moduleKey) {
      return isOwner() || (isMember() && moduleKey in memberDoc().data.modules);
    }

    match /_tk_config/{docId} {
      allow read: if docId == 'project' || signedIn();
      allow create, update: if docId == 'project' && isOwner() && request.resource.data.initialized == true;
      allow create: if signedIn() && docId == 'owner' && request.resource.data.email == request.auth.token.email.lower();
      allow update: if signedIn()
        && docId == 'owner'
        && resource.data.email == request.auth.token.email.lower()
        && request.resource.data.email == resource.data.email;
      allow update, delete: if isOwner();
    }

    match /members/{email} {
      allow read: if signedIn() && (request.auth.token.email.lower() == email || isOwner());
      allow create: if signedIn() && (
        (email == request.auth.token.email.lower() && (
          !exists(/databases/$(database)/documents/_tk_config/owner)
          || get(/databases/$(database)/documents/_tk_config/owner).data.email == request.auth.token.email.lower()
        ))
        || isOwner()
      );
      allow update: if isOwner() || (
        signedIn()
        && email == request.auth.token.email.lower()
        && resource.data.role == 'owner'
        && request.resource.data.role == 'owner'
        && request.resource.data.email == resource.data.email
      );
      allow delete: if isOwner();
    }

    match /orders/{orderId} {
      allow read, write: if canUse('orders');
    }

    match /order_accounts/{accountId} {
      allow read, write: if canUse('orders') || canUse('products') || canUse('finance');
    }

    match /sync_state/{scope} {
      allow read, write: if canUse('orders');
    }

    match /products/{productId} {
      allow read, write: if canUse('products') || canUse('orders');
    }

    match /finance_records/{recordId} {
      allow read, write: if canUse('finance');
    }

    match /collection_records/{productKey} {
      allow read, write: if canUse('collection');
    }

    match /collection_excluded_products/{productKey} {
      allow read, write: if canUse('collection');
    }

    match /analytics_snapshots/{snapshotId} {
      allow read, write: if canUse('analytics');
    }

    match /analytics_records/{recordId} {
      allow read, write: if canUse('analytics');
    }

    match /_tk_probe/{probeId} {
      allow read, write: if isMember();
    }
  }
}`;

export {
  ORDER_TRACKER_FIRESTORE_RULES
};
