//! Native implementations of the `app` namespace's desktop methods. These
//! replace the Electron APIs the old main process used; semantics mirror
//! src/main/ipc/api.ts from the Electron build.

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// Validate a #rrggbb colour (parity with the old setTitleBarColors guard).
fn is_hex_color(s: &str) -> bool {
    s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit())
}

const MAIN_WINDOW_LABEL: &str = "main";

/// The main webview window, or an error when it is gone (e.g. closed).
fn main_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "Main window is unavailable".to_string())
}

/// Await the non-blocking dialog APIs so pickers never run on the main
/// thread (the blocking_* variants deadlock the event loop there).
/// `dialog_call` invokes the desired picker on the fresh builder and hands
/// the result to `tx`.
async fn pick_async(
    app: &AppHandle,
    dialog_call: impl FnOnce(
        tauri_plugin_dialog::FileDialogBuilder<tauri::Wry>,
        std::sync::mpsc::Sender<Option<tauri_plugin_dialog::FilePath>>,
    ),
) -> Option<tauri_plugin_dialog::FilePath> {
    let (tx, rx) = std::sync::mpsc::channel();
    dialog_call(app.dialog().file(), tx);
    tauri::async_runtime::spawn_blocking(move || {
        // Bound the wait so a never-firing dialog callback can't pin a pooled
        // thread forever.
        rx.recv_timeout(std::time::Duration::from_secs(300))
            .ok()
            .flatten()
    })
    .await
    .ok()
    .flatten()
}

pub async fn app_call(app: &AppHandle, method: &str, args: Value) -> Result<Value, String> {
    let argv: Vec<Value> = args.as_array().cloned().unwrap_or_default();
    match method {
        "openExternal" => {
            let url = argv.first().and_then(Value::as_str).unwrap_or("");
            if !url.starts_with("https://") {
                return Err("Only https links can be opened.".into());
            }
            app.opener()
                .open_url(url, None::<&str>)
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "copy" => {
            let text = argv
                .first()
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            app.clipboard()
                .write_text(text)
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "pickDirectory" => {
            let path = pick_async(app, |b, tx| {
                b.pick_folder(move |p| {
                    let _ = tx.send(p);
                })
            })
            .await;
            Ok(path.map(|p| json!(p.to_string())).unwrap_or(Value::Null))
        }
        "pickFile" => {
            let path = pick_async(app, |b, tx| {
                b.pick_file(move |p| {
                    let _ = tx.send(p);
                })
            })
            .await;
            Ok(path.map(|p| json!(p.to_string())).unwrap_or(Value::Null))
        }
        "revealPath" => {
            let target = argv.first().and_then(Value::as_str).unwrap_or("");
            let p = std::path::Path::new(target);
            if !p.exists() {
                return Err(format!("Not found: {target}"));
            }
            // Opens the containing folder with the item selected, like
            // Explorer's / Finder's "Show in folder".
            app.opener()
                .reveal_item_in_dir(p)
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "setTheme" => {
            let mode = argv.first().and_then(Value::as_str).unwrap_or("system");
            let theme = match mode {
                "light" => Some(tauri::Theme::Light),
                "dark" => Some(tauri::Theme::Dark),
                _ => None,
            };
            if let Some(w) = app.get_webview_window("main") {
                w.set_theme(theme).map_err(|e| e.to_string())?;
            }
            Ok(Value::Null)
        }
        "setTitleBarColors" => {
            let color = argv.first().and_then(Value::as_str).unwrap_or("");
            let symbol = argv.get(1).and_then(Value::as_str).unwrap_or("");
            if !is_hex_color(color) || !is_hex_color(symbol) {
                return Err("Colours must be #rrggbb.".into());
            }
            // Tauri does not expose per-button overlay colours on Windows yet;
            // theme tracking via setTheme is the supported path. No-op.
            Ok(Value::Null)
        }
        "showAppMenu" => {
            // The app menu is registered at startup; pop it up where asked.
            let x = argv.first().and_then(Value::as_f64).unwrap_or(0.0);
            let y = argv.get(1).and_then(Value::as_f64).unwrap_or(0.0);
            if let Some(w) = app.get_webview_window("main") {
                if let Some(menu) = app.menu() {
                    let _ = w.popup_menu_at(
                        &menu,
                        tauri::Position::Logical(tauri::LogicalPosition::new(x, y)),
                    );
                }
            }
            Ok(Value::Null)
        }
        "isMaximized" => {
            let w = main_window(app)?;
            Ok(json!(w.is_maximized().map_err(|e| e.to_string())?))
        }
        "minimizeWindow" => {
            let w = main_window(app)?;
            w.minimize().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "toggleMaximize" => {
            let w = main_window(app)?;
            if w.is_maximized().map_err(|e| e.to_string())? {
                w.unmaximize().map_err(|e| e.to_string())?;
            } else {
                w.maximize().map_err(|e| e.to_string())?;
            }
            Ok(json!(w.is_maximized().map_err(|e| e.to_string())?))
        }
        "closeWindow" => {
            let w = main_window(app)?;
            w.close().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "cliStatus" => {
            // The Tauri installer no longer manages PATH shims; the npm
            // package is the CLI delivery path. Report honestly.
            Ok(json!({
                "installed": false,
                "onPath": false,
                "binDir": "",
                "commands": ["lanyard", "lny"],
                "packaged": !cfg!(debug_assertions),
            }))
        }
        other => Err(format!("Unknown method app.{other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_color_validation() {
        assert!(is_hex_color("#17181c"));
        assert!(is_hex_color("#FFFFFF"));
        assert!(!is_hex_color("#fff"));
        assert!(!is_hex_color("red"));
        assert!(!is_hex_color("#17181g"));
    }
}
