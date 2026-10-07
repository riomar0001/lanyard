//! Lanyard Tauri shell. The window loads the React renderer; all domain work
//! happens in the Node sidecar (src/sidecar) behind the single `api_invoke`
//! command, preserving the LanyardApi envelope from the Electron build.

mod native;
mod router;
mod sidecar;
mod tray;

use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Listener, Manager, WindowEvent};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
async fn api_invoke(
    app: AppHandle,
    namespace: String,
    method: String,
    args: Value,
) -> Result<Value, String> {
    if router::is_native(&namespace, &method) {
        return native::app_call(&app, &method, args).await;
    }
    // The sidecar round-trip blocks on a channel recv; keep it off the main
    // thread so slow domain calls never freeze the UI.
    let sidecar = app.state::<Arc<sidecar::Sidecar>>().inner().clone();
    let ns = namespace.clone();
    let result = tauri::async_runtime::spawn_blocking(move || sidecar.call(&ns, &method, args))
        .await
        .map_err(|e| format!("sidecar task failed: {e}"))?;
    if namespace == "settings" {
        cache_close_to_tray(&app, &result);
    }
    Ok(result)
}

/// Cache the close-to-tray setting so the window-event handler never blocks on
/// the sidecar. Defaults to true while the setting is unknown.
fn cache_close_to_tray(app: &AppHandle, response: &Value) {
    if let Some(enabled) = response
        .get("data")
        .and_then(|d| d.get("closeToTray"))
        .and_then(Value::as_bool)
    {
        if let Some(flag) = app.try_state::<AtomicBool>() {
            flag.store(enabled, Ordering::Relaxed);
        }
    }
}

/// Coalesces tray refreshes: `lanyard:changed` fires in bursts from the file
/// watcher, but only one refresh needs to be in flight at a time. Distinct
/// newtype because Tauri panics on managing the same state type twice.
#[derive(Default)]
struct TrayRefreshPending(Arc<AtomicBool>);

/// Last maximized value we emitted as `lanyard:window-state`; prevents an IPC
/// event per resize tick.
struct LastMaximized(AtomicBool);

/// The Node runtime for the sidecar: the one bundled next to the app binary
/// (tauri.conf.json `externalBin`, fetched by scripts/fetch-node.mjs), so the
/// app works without a Node install and when launched from Finder or the Start
/// menu, which don't see a shell's PATH. Falls back to `node` on the PATH.
fn node_program() -> String {
    let name = if cfg!(windows) { "node.exe" } else { "node" };
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.join(name)))
        .filter(|path| path.is_file())
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_else(|| "node".into())
}

fn sidecar_script(app: &AppHandle) -> (String, String) {
    // Packaged: resources/sidecar/index.js next to the binary; dev: out/sidecar.
    if let Ok(dir) = app.path().resource_dir() {
        let candidate = dir.join("sidecar").join("index.js");
        if candidate.exists() {
            return (node_program(), candidate.to_string_lossy().into_owned());
        }
    }
    let dev = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../out/sidecar/index.js")
        .canonicalize()
        .expect("out/sidecar/index.js missing — run `npm run build` first");
    (node_program(), dev.to_string_lossy().into_owned())
}

fn build_app_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let nav = |label: &str, page: &str, accel: Option<&str>| {
        MenuItem::with_id(app, format!("nav:{page}"), label, true, accel).expect("menu item")
    };
    let pages = Submenu::new(app, "Go", true)?;
    for (i, (label, page)) in [
        ("Overview", "overview"),
        ("Git accounts", "accounts"),
        ("Hosts", "hosts"),
        ("Keys", "keys"),
        ("ssh-agent", "agent"),
        ("Known hosts", "known-hosts"),
        ("Backups", "backups"),
        ("Settings", "settings"),
    ]
    .iter()
    .enumerate()
    {
        pages.append(&nav(label, page, Some(&format!("CmdOrCtrl+{}", i + 1))))?;
    }

    let file = Submenu::new(app, "File", true)?;
    file.append(&nav(
        "Add Git Account…",
        "accounts:add-account",
        Some("CmdOrCtrl+N"),
    ))?;
    file.append(&nav(
        "Add Host…",
        "hosts:add-host",
        Some("CmdOrCtrl+Shift+N"),
    ))?;
    file.append(&nav("Generate SSH Key…", "keys:generate-key", None))?;
    file.append(&nav("Scan Host Keys…", "known-hosts:scan-host", None))?;
    file.append(&PredefinedMenuItem::separator(app)?)?;
    file.append(&nav("Edit Raw SSH Config", "hosts:raw-config", None))?;
    file.append(&nav("Settings…", "settings", Some("CmdOrCtrl+,")))?;
    file.append(&PredefinedMenuItem::separator(app)?)?;
    file.append(&MenuItem::with_id(
        app,
        "app:quit",
        "Quit Lanyard",
        true,
        Some("CmdOrCtrl+Q"),
    )?)?;

    let edit = Submenu::new(app, "Edit", true)?;
    for item in [
        PredefinedMenuItem::undo(app, None)?,
        PredefinedMenuItem::redo(app, None)?,
        PredefinedMenuItem::separator(app)?,
        PredefinedMenuItem::cut(app, None)?,
        PredefinedMenuItem::copy(app, None)?,
        PredefinedMenuItem::paste(app, None)?,
        PredefinedMenuItem::select_all(app, None)?,
    ] {
        edit.append(&item)?;
    }

    // Items the window or the renderer handles. Their shortcuts are handled
    // there too (the menu only shows them), so they work without the menu.
    let item = |id: &str, label: &str, accel: Option<&str>| {
        MenuItem::with_id(app, id, label, true, accel).expect("menu item")
    };

    let view = Submenu::new(app, "View", true)?;
    view.append(&item(
        "cmd:palette",
        "Command Palette…",
        Some("CmdOrCtrl+K"),
    ))?;
    view.append(&PredefinedMenuItem::separator(app)?)?;
    view.append(&item("cmd:zoom-reset", "Actual Size", Some("CmdOrCtrl+0")))?;
    view.append(&item("cmd:zoom-in", "Zoom In", Some("CmdOrCtrl+=")))?;
    view.append(&item("cmd:zoom-out", "Zoom Out", Some("CmdOrCtrl+-")))?;
    view.append(&PredefinedMenuItem::separator(app)?)?;
    // A plain item rather than PredefinedMenuItem::fullscreen, which muda
    // leaves out of the menu on Windows and GTK.
    view.append(&item("win:fullscreen", "Toggle Full Screen", None))?;

    let history = Submenu::new(app, "History", true)?;
    history.append(&item("cmd:back", "Back", Some("Alt+Left")))?;
    history.append(&item("cmd:forward", "Forward", Some("Alt+Right")))?;

    let help = Submenu::new(app, "Help", true)?;
    help.append(&nav("About Lanyard", "settings:about", None))?;
    help.append(&nav("Command Line Tool", "settings", None))?;
    help.append(&PredefinedMenuItem::separator(app)?)?;
    help.append(&item("open:ssh", "Open SSH Folder", None))?;
    help.append(&item("open:data", "Open Lanyard Data Folder", None))?;
    help.append(&nav("Backups", "backups", None))?;
    help.append(&PredefinedMenuItem::separator(app)?)?;
    help.append(&item("url:docs", "User Guide", None))?;
    help.append(&item("url:issues", "Report a Problem", None))?;

    let menu = Menu::new(app)?;
    for sub in [file, edit, view, pages, history, help] {
        menu.append(&sub)?;
    }
    Ok(menu)
}

/// Opens one of Lanyard's folders. The paths come from the sidecar, which
/// knows about LANYARD_SSH_DIR / LANYARD_HOME; the round trip blocks, so it
/// runs off the main thread.
fn open_folder(app: &AppHandle, which: &str) {
    let key = if which == "ssh" { "sshDir" } else { "dataDir" };
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let sidecar = app.state::<Arc<sidecar::Sidecar>>().inner().clone();
        let reply = sidecar.call("app", "info", serde_json::json!([]));
        if let Some(dir) = reply["data"]["paths"][key].as_str() {
            let _ = app.opener().open_path(dir, None::<&str>);
        }
    });
}

fn on_app_menu_event(app: &AppHandle, id: &str) {
    if let Some(rest) = id.strip_prefix("nav:") {
        let mut parts = rest.split(':');
        let page = parts.next().unwrap_or("overview").to_string();
        let intent = parts.next().map(str::to_string);
        tray::show_window(app, Some((page, intent)));
    } else if let Some(cmd) = id.strip_prefix("cmd:") {
        tray::show_window(app, None);
        let _ = app.emit("lanyard:command", cmd);
    } else if id == "win:fullscreen" {
        if let Some(w) = app.get_webview_window("main") {
            let full = w.is_fullscreen().unwrap_or(false);
            let _ = w.set_fullscreen(!full);
        }
    } else if let Some(which) = id.strip_prefix("open:") {
        open_folder(app, which);
    } else if let Some(page) = id.strip_prefix("url:") {
        let url = match page {
            "docs" => "https://lanyard.riomar.dev/docs/",
            _ => "https://github.com/riomar0001/lanyard/issues/new/choose",
        };
        let _ = app.opener().open_url(url, None::<&str>);
    } else if id == "app:quit" {
        app.exit(0);
    }
}

/// Menu ids handled by the app menu; everything else belongs to the tray.
fn is_app_menu_id(id: &str) -> bool {
    ["nav:", "cmd:", "win:", "open:", "url:"]
        .iter()
        .any(|prefix| id.starts_with(prefix))
        || id == "app:quit"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_window(app, None);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .setup(|app| {
            let (program, script) = sidecar_script(app.handle());
            let sidecar = sidecar::Sidecar::spawn(app.handle().clone(), &program, &script, &[])?;
            app.manage(sidecar);
            // Close-to-tray cache; true = the safe default while unknown.
            app.manage(AtomicBool::new(true));
            app.manage(TrayRefreshPending::default());
            // `true` makes the first resize emit (the initial maximized state
            // is not yet known, so treat it as changed).
            app.manage(LastMaximized(AtomicBool::new(true)));

            let menu = build_app_menu(app.handle())?;
            app.set_menu(menu)?;
            app.handle().on_menu_event(|app, event| {
                let id = event.id().0.clone();
                if is_app_menu_id(&id) {
                    on_app_menu_event(app, &id);
                } else {
                    tray::on_menu_event(app, &id);
                }
            });

            let tray = TrayIconBuilder::with_id("main")
                .tooltip("Lanyard")
                .icon(app.default_window_icon().unwrap().clone())
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        ..
                    } = event
                    {
                        tray::show_window(tray.app_handle(), None);
                    }
                })
                .build(app)?;

            // Warm the tray menu off the main thread: refresh_tray performs a
            // blocking sidecar round-trip, which must never run in setup. The
            // tray menu populates a moment after startup.
            let sidecar2 = app.state::<Arc<sidecar::Sidecar>>().inner().clone();
            let handle2 = app.handle().clone();
            app.manage(tray);
            tauri::async_runtime::spawn_blocking(move || {
                let tray = handle2.state::<tauri::tray::TrayIcon>().inner().clone();
                tray::refresh_tray(&handle2, &tray, &sidecar2);
                // Also warm the close-to-tray cache off-thread so users with
                // closeToTray=false are honoured even in the first moments.
                let v = sidecar2.call("settings", "get", serde_json::json!([]));
                cache_close_to_tray(&handle2, &v);
            });

            // Refresh the tray whenever the sidecar reports file/state changes.
            let handle = app.handle().clone();
            let listener_handle = handle.clone();
            let pending = handle.state::<TrayRefreshPending>().inner().0.clone();
            listener_handle.listen("lanyard:changed", move |_| {
                // Coalesce watcher bursts: only one refresh in flight; later
                // events while one runs are covered by that refresh.
                if pending
                    .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
                    .is_err()
                {
                    return;
                }
                // This listener runs inline on the sidecar's stdout reader
                // thread (sidecar.rs emits the event from there), so calling
                // sidecar.call here would self-deadlock: the response can only
                // be read by that same reader thread. Run the whole refresh —
                // including its blocking sidecar.call — on a blocking thread.
                let h = handle.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    let sidecar = h.state::<Arc<sidecar::Sidecar>>().inner().clone();
                    let tray = h.state::<tauri::tray::TrayIcon>().inner().clone();
                    tray::refresh_tray(&h, &tray, &sidecar);
                    h.state::<TrayRefreshPending>()
                        .inner()
                        .0
                        .store(false, Ordering::SeqCst);
                });
            });

            #[cfg(windows)]
            if let Err(e) = tray::migrate_legacy_autostart(app.handle()) {
                eprintln!("autostart migration failed: {e}");
            }

            // Start hidden with --hidden (login autostart).
            let hidden = std::env::args().any(|a| a == "--hidden");
            if !hidden {
                tray::show_window(app.handle(), None);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::Resized(_) => {
                    let maximized = window.is_maximized().unwrap_or(false);
                    let app = window.app_handle();
                    let last = app
                        .state::<LastMaximized>()
                        .inner()
                        .0
                        .load(Ordering::Relaxed);
                    if maximized != last {
                        app.state::<LastMaximized>()
                            .inner()
                            .0
                            .store(maximized, Ordering::Relaxed);
                        let _ = window.emit("lanyard:window-state", maximized);
                    }
                }
                WindowEvent::CloseRequested { api, .. } => {
                    // Close-to-tray: read the cached setting only — never block
                    // the event loop on a sidecar round-trip here. Unknown
                    // defaults to true.
                    let close_to_tray = window
                        .app_handle()
                        .try_state::<AtomicBool>()
                        .map(|flag| flag.load(Ordering::Relaxed))
                        .unwrap_or(true);
                    if close_to_tray {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![api_invoke])
        .run(tauri::generate_context!())
        .expect("error while running lanyard");
}
