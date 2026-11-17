// Transport stand-in: this entry never initializes the Firebase SDK.
export const app = { options: { projectId: "gymduck-local-preview", storageBucket: "gymduck-local-preview" } };
export const auth = { currentUser: { uid: "local-admin", displayName: "Администратор", email: "admin@example.test" } };
export const db = { path: "" };
