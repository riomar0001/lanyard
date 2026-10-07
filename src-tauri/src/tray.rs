//! System tray. The menu structure comes from the sidecar (`menu.traySpec`)
//! as JSON; this module only materializes it into Tauri menu items and routes
//! clicks back (`menu.act`) unless the id is `app:`-prefixed (handled here).

use serde::Deserialize;
use std::sync::Arc;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, MenuItemKind, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIcon;
use tauri::{AppHandle, Emitter, Manager};

use crate::sidecar::Sidecar;

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrayMenuItemSpec {
    pub id: Option<String>,
    pub label: Option<String>,
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub checked: Option<bool>,
    pub enabled: Option<bool>,
    pub submenu: Option<Vec<TrayMenuItemSpec>>,
}

#[derive(Debug, Deserialize)]
pub struct TraySpec {
    pub tooltip: String,
    pub items: Vec<TrayMenuItemSpec>,
}

/// Turn a spec into a concrete menu item; `Menu::append`/`Submenu::append`
/// both accept any `IsMenuItem`, and `MenuItemKind` boxes the variants.
fn make_item(app: &AppHandle, item: &TrayMenuItemSpec) -> tauri::Result<MenuItemKind<tauri::Wry>> {
    if item.kind.as_deref() == Some("separator") {
        return Ok(MenuItemKind::Predefined(PredefinedMenuItem::separator(
            app,
        )?));
    }
    let label = item.label.clone().unwrap_or_default();
    let enabled = item.enabled.unwrap_or(true);
    if let Some(sub) = &item.submenu {
        let submenu = Submenu::with_id(app, format!("sub:{label}"), &label, enabled)?;
        for child in sub {
            submenu.append(&make_item(app, child)?)?;
        }
        return Ok(MenuItemKind::Submenu(submenu));
    }
    let id = item.id.clone().unwrap_or_else(|| format!("noop:{label}"));
    match item.kind.as_deref() {
        Some("radio") | Some("checkbox") => Ok(MenuItemKind::Check(CheckMenuItem::with_id(
            app,
            &id,
            &label,
            enabled,
            item.checked.unwrap_or(false),
            None::<&str>,
        )?)),
        _ => Ok(MenuItemKind::MenuItem(MenuItem::with_id(
            app,
            &id,
            &label,
            enabled,
            None::<&str>,
        )?)),
    }
}

/// Rebuild the tray menu from the sidecar's current spec.
pub fn refresh_tray(app: &AppHandle, tray: &TrayIcon, sidecar: &Arc<Sidecar>) {
    let spec_value = sidecar.call("menu", "traySpec", serde_json::json!([]));
    let spec: TraySpec =
        match serde_json::from_value(spec_value.get("data").cloned().unwrap_or_default()) {
            Ok(s) => s,
            Err(err) => {
                eprintln!("tray: bad spec: {err}");
                return;
            }
        };
    let _ = tray.set_tooltip(Some(&spec.tooltip));
    match build_menu(app, &spec.items) {
        Ok(menu) => {
            let _ = tray.set_menu(Some(menu));
        }
        Err(err) => eprintln!("tray: could not build menu: {err}"),
    }
}

fn build_menu(app: &AppHandle, items: &[TrayMenuItemSpec]) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    for item in items {
        menu.append(&make_item(app, item)?)?;
    }
    Ok(menu)
}

/// Handle a tray menu click. `app:` ids are shell concerns; the rest go to
/// the sidecar.
pub fn on_menu_event(app: &AppHandle, id: &str) {
    match id {
        "app:open" => show_window(app, None),
        "app:quit" => {
            app.exit(0);
        }
        "app:toggle-login" => {
            let _ = toggle_autostart(app);
        }
        _ => {
            if let Some(sidecar) = app.try_state::<Arc<Sidecar>>() {
                let sidecar = Arc::clone(sidecar.inner());
                let id = id.to_string();
                tauri::async_runtime::spawn_blocking(move || {
                    sidecar.call("menu", "act", serde_json::json!([id]));
                });
            }
        }
    }
}

/// Show (and optionally navigate) the main window.
pub fn show_window(app: &AppHandle, nav: Option<(String, Option<String>)>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        if let Some((page, intent)) = nav {
            let _ = app.emit(
                "lanyard:navigate",
                serde_json::json!({ "page": page, "intent": intent }),
            );
        }
    }
}

fn toggle_autostart(app: &AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let autostart = app.autolaunch();
    if autostart.is_enabled().map_err(|e| e.to_string())? {
        autostart.disable().map_err(|e| e.to_string())?;
    } else {
        autostart.enable().map_err(|e| e.to_string())?;
    }
    Ok(())
}
