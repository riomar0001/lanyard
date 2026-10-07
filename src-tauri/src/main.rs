// Release builds are GUI apps on Windows: no console window next to the app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    lanyard_lib::run()
}
