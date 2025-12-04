use tauri::Manager;

use crate::{
    error::make_tauri_result,
    shared::lark_helper_session,
    utils::{
        lark::find::LarkFinder,
        platform::process::{
            is_process_running, kill_all_processes, wait_until_all_processes_ended,
        },
    },
};

pub mod error;
pub mod shared;
pub mod utils;

#[tauri::command]
fn is_lark_running() -> bool {
    is_process_running("Feishu.exe")
}

#[tauri::command]
fn kill_lark() -> bool {
    kill_all_processes("Feishu.exe")
}

#[tauri::command]
async fn wait_until_lark_ended() {
    wait_until_all_processes_ended("Feishu.exe").await;
}

#[tauri::command]
fn get_lark_path() -> tauri::Result<String> {
    make_tauri_result(lark_helper_session(|helper| helper.locate()))
}

fn setup_debug(app: &mut tauri::App) {
    let windows_map = app.webview_windows();
    let windows = windows_map.values().collect::<Vec<_>>();
    windows.iter().for_each(|w| w.open_devtools());
}

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    if tauri::is_dev() {
        setup_debug(app);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(setup)
        .invoke_handler(tauri::generate_handler![
            get_lark_path,
            is_lark_running,
            kill_lark,
            wait_until_lark_ended,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
