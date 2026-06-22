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
        theme_store,
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
fn close_lark_session(id: String) -> tauri::Result<()> {
    session::close_lark_session(&id).map_err(|_| tauri::Error::InvokeKey)?;
    Ok(())
}

#[tauri::command]
fn invoke_lark_session(id: String, command: String, args: Vec<String>) -> tauri::Result<String> {
    let result =
        session::interpret_command(&id, &command, args).map_err(|_| tauri::Error::InvokeKey)?;
    Ok(result)
}

fn app_data_dir(app: &AppHandle) -> tauri::Result<std::path::PathBuf> {
    app.path()
        .app_data_dir()
        .map_err(|_| tauri::Error::InvokeKey)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PickedThemeDto {
    suggested_id: String,
    content: String,
}

/// 弹出文件选择框并读取选中 YAML 的内容（不写入托管目录）。返回内容与回退 id；取消时返回 null。
#[tauri::command]
async fn pick_theme_file(app: AppHandle) -> tauri::Result<Option<PickedThemeDto>> {
    use tauri_plugin_dialog::DialogExt;

    let picked = app
        .dialog()
        .file()
        .add_filter("Wal 主题", &["yaml", "yml"])
        .blocking_pick_file();

    let Some(file_path) = picked else {
        // 用户取消选择
        return Ok(None);
    };

    let src = file_path.into_path().map_err(|_| tauri::Error::InvokeKey)?;
    let picked = theme_store::read_source(&src).map_err(|_| tauri::Error::InvokeKey)?;
    Ok(Some(PickedThemeDto {
        suggested_id: picked.suggested_id,
        content: picked.content,
    }))
}

/// 按 id 派生文件名写入托管目录（同名覆盖），返回实际文件名。
#[tauri::command]
fn save_theme(app: AppHandle, id: String, content: String) -> tauri::Result<String> {
    let dir = app_data_dir(&app)?;
    theme_store::save_theme(&dir, &id, &content).map_err(|_| tauri::Error::InvokeKey)
}

/// 从托管目录新鲜读取一个主题文件（始终读盘，外部编辑后立即生效）
#[tauri::command]
fn read_theme(app: AppHandle, file_name: String) -> tauri::Result<String> {
    let dir = app_data_dir(&app)?;
    theme_store::read_theme(&dir, &file_name).map_err(|_| tauri::Error::InvokeKey)
}

#[tauri::command]
fn delete_theme(app: AppHandle, file_name: String) -> tauri::Result<()> {
    let dir = app_data_dir(&app)?;
    theme_store::delete_theme(&dir, &file_name).map_err(|_| tauri::Error::InvokeKey)
}

#[tauri::command]
fn read_theme_manifest(app: AppHandle) -> tauri::Result<String> {
    let dir = app_data_dir(&app)?;
    theme_store::read_manifest(&dir).map_err(|_| tauri::Error::InvokeKey)
}

#[tauri::command]
fn write_theme_manifest(app: AppHandle, content: String) -> tauri::Result<()> {
    let dir = app_data_dir(&app)?;
    theme_store::write_manifest(&dir, &content).map_err(|_| tauri::Error::InvokeKey)
}

#[tauri::command]
fn open_lark_install_directory() -> tauri::Result<()> {
    let path = get_lark_base_path().map_err(|_| tauri::Error::InvokeKey)?;
    let _ = tokio::process::Command::new("explorer.exe")
        .arg(path.as_str())
        .spawn();
    Ok(())
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
    } else {
        let windows_map = app.webview_windows();
        let windows = windows_map.values().collect::<Vec<_>>();
        windows.iter().for_each(|w| {
            let _ = w.eval(
                r#"window.addEventListener('DOMContentLoaded', () => {
                    document.body.oncontextmenu = function(e) { e.preventDefault(); return false };
                    const style = document.createElement('style');
                    style.textContent = '*, *::before, *::after { user-select: none !important; -webkit-user-select: none !important; }';
                    document.head.appendChild(style);
                })"#,
            );
        });
    }
    subscribe_log(app.handle());
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(setup)
        .invoke_handler(tauri::generate_handler![
            get_lark_base_path,
            is_lark_running,
            kill_lark,
            launch_lark,
            wait_until_lark_ended,
            create_lark_session,
            invoke_lark_session,
            close_lark_session,
            open_lark_install_directory,
            pick_theme_file,
            save_theme,
            read_theme,
            delete_theme,
            read_theme_manifest,
            write_theme_manifest,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
