use tauri::{AppHandle, Emitter, Manager};

use crate::{
    error::make_tauri_result,
    shared::lark_helper_session,
    utils::{
        lark::{find::LarkFinder, wrappers::session},
        log::logger,
        platform::{
            os::join_components,
            process::{
                is_process_running, kill_all_processes, launch_process,
                wait_until_all_processes_ended,
            },
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
fn launch_lark() -> () {
    let _ = lark_helper_session(|helper| {
        let path = helper.locate()?;
        let lark_path = join_components(&[&path, "Feishu.exe"])?;
        let _ = launch_process(&lark_path);
        Ok(())
    });
}

#[tauri::command]
fn get_lark_base_path() -> tauri::Result<String> {
    make_tauri_result(lark_helper_session(|helper| helper.locate()))
}

#[tauri::command]
fn create_lark_session() -> tauri::Result<String> {
    let session = session::create_lark_session().map_err(|_| tauri::Error::InvokeKey)?;
    let session = session.lock().map_err(|_| tauri::Error::InvokeKey)?;
    Ok(session.id().to_owned())
}

#[tauri::command]
fn invoke_lark_session(id: String, command: String, args: Vec<String>) -> tauri::Result<String> {
    let result =
        session::interpret_command(&id, &command, args).map_err(|_| tauri::Error::InvokeKey)?;
    Ok(result)
}

fn subscribe_log(app: &AppHandle) {
    let app_handle = tauri::AppHandle::clone(app);
    let _ = logger::subscribe_log(Box::new(move |message| {
        let _ = app_handle.emit("log-events", format!("[NATIVE] {}", message));
    }));
}

#[cfg(debug_assertions)]
fn setup_debug(app: &mut tauri::App) {
    let windows_map = app.webview_windows();
    let windows = windows_map.values().collect::<Vec<_>>();
    windows.iter().for_each(|w| w.open_devtools());
}

#[cfg(not(debug_assertions))]
fn setup_debug(_: &mut tauri::App) {
    println!("setup_release");
}

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    if tauri::is_dev() {
        setup_debug(app);
    }
    subscribe_log(app.handle());
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(setup)
        .invoke_handler(tauri::generate_handler![
            get_lark_base_path,
            is_lark_running,
            kill_lark,
            launch_lark,
            wait_until_lark_ended,
            create_lark_session,
            invoke_lark_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
