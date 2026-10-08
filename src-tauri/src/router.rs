//! Routing decision: which `api_invoke` calls are answered natively in Rust
//! and which are proxied to the sidecar. Pure and unit-testable.

use serde_json::{json, Value};

/// `app` sub-methods implemented natively (desktop concerns, no core needed).
pub const NATIVE_APP_METHODS: &[&str] = &[
    "openExternal",
    "copy",
    "pickDirectory",
    "pickFile",
    "revealPath",
    "setTheme",
    "setTitleBarColors",
    "showAppMenu",
    "isMaximized",
    "minimizeWindow",
    "toggleMaximize",
    "closeWindow",
    "cliStatus",
];

pub fn is_native(namespace: &str, method: &str) -> bool {
    namespace == "app" && NATIVE_APP_METHODS.contains(&method)
}

/// Wrap a native result in the `IpcResponse` envelope the sidecar already
/// answers with, so the renderer can read `ok` on every reply.
pub fn envelope(result: Result<Value, String>) -> Value {
    match result {
        Ok(data) => json!({ "ok": true, "data": data }),
        Err(error) => json!({ "ok": false, "error": error }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routes_native_app_methods() {
        assert!(is_native("app", "copy"));
        assert!(is_native("app", "pickDirectory"));
        assert!(is_native("app", "setTheme"));
    }

    #[test]
    fn wraps_native_results_in_the_ipc_envelope() {
        assert_eq!(
            envelope(Ok(Value::Null)),
            json!({ "ok": true, "data": null })
        );
        assert_eq!(
            envelope(Ok(json!(true))),
            json!({ "ok": true, "data": true })
        );
        assert_eq!(
            envelope(Err("Only https links can be opened.".into())),
            json!({ "ok": false, "error": "Only https links can be opened." })
        );
    }

    #[test]
    fn routes_everything_else_to_sidecar() {
        assert!(!is_native("settings", "get"));
        assert!(!is_native("app", "info"));
        assert!(!is_native("hosts", "list"));
    }
}
