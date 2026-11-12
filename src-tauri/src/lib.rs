use tauri::{AppHandle, Emitter, Manager};

use crate::{
    error::{make_tauri_result, WalResult},
    shared::lark_helper_session,
    utils::{
        lark::{find::LarkFinder, wrappers::session},
        log::logger,
        platform::process,
        theme_store,
    },
};

pub mod error;
pub mod shared;
pub mod utils;

#[tauri::command]
async fn is_lark_running() -> Result<bool, String> {
    blocking(|| with_lark_path(process::is_running)).await
}

#[tauri::command]
async fn kill_lark() -> Result<(), String> {
    blocking(|| {
        let _operation = crate::shared::lock_lark_operation()?;
        with_lark_path(process::kill)
    })
    .await
}

#[tauri::command]
async fn wait_until_lark_ended() -> Result<(), String> {
    while is_lark_running().await? {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
    Ok(())
}

#[tauri::command]
async fn launch_lark() -> Result<(), String> {
    blocking(|| {
        let _operation = crate::shared::lock_lark_operation()?;
        with_lark_path(process::launch)
    })
    .await
}

fn with_lark_path<T>(callback: impl FnOnce(&std::path::Path) -> WalResult<T>) -> WalResult<T> {
    let path = lark_helper_session(|helper| helper.locate())?;
    callback(std::path::Path::new(&path))
}

async fn blocking<T: Send + 'static>(
    callback: impl FnOnce() -> WalResult<T> + Send + 'static,
) -> Result<T, String> {
    let result = tauri::async_runtime::spawn_blocking(callback)
        .await
        .map_err(|error| error.to_string())?;
    make_tauri_result(result)
}

#[tauri::command]
fn get_lark_base_path() -> Result<String, String> {
    make_tauri_result(lark_helper_session(|helper| helper.locate()))
}

#[tauri::command]
fn create_lark_session() -> Result<String, String> {
    let session = make_tauri_result(session::create_lark_session())?;
    let session = session.lock().map_err(|error| error.to_string())?;
    Ok(session.id().to_owned())
}

#[tauri::command]
fn close_lark_session(id: String) -> Result<(), String> {
    make_tauri_result(session::close_lark_session(&id))
}

#[tauri::command]
async fn invoke_lark_session(
    id: String,
    command: String,
    args: Vec<String>,
) -> Result<String, String> {
    blocking(move || session::interpret_command(&id, &command, args)).await
}

fn app_data_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| error.to_string())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PickedThemeDto {
    suggested_id: String,
    content: String,
}

/// 弹出文件选择框并读取选中 YAML 的内容（不写入托管目录）。返回内容与回退 id；取消时返回 null。
#[tauri::command]
async fn pick_theme_file(app: AppHandle) -> Result<Option<PickedThemeDto>, String> {
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

    let src = file_path.into_path().map_err(|error| format!("无法读取所选文件路径: {error}"))?;
    let picked = theme_store::read_source(&src).map_err(|error| error.to_string())?;
    Ok(Some(PickedThemeDto {
        suggested_id: picked.suggested_id,
        content: picked.content,
    }))
}

/// 按 id 派生文件名写入托管目录（同名覆盖），返回实际文件名。
#[tauri::command]
fn save_theme(app: AppHandle, id: String, content: String) -> Result<String, String> {
    let dir = app_data_dir(&app)?;
    theme_store::save_theme(&dir, &id, &content).map_err(|error| error.to_string())
}

/// 从托管目录新鲜读取一个主题文件（始终读盘，外部编辑后立即生效）
#[tauri::command]
fn read_theme(app: AppHandle, file_name: String) -> Result<String, String> {
    let dir = app_data_dir(&app)?;
    theme_store::read_theme(&dir, &file_name).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_theme(app: AppHandle, file_name: String) -> Result<(), String> {
    let dir = app_data_dir(&app)?;
    theme_store::delete_theme(&dir, &file_name).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_theme_manifest(app: AppHandle) -> Result<String, String> {
    let dir = app_data_dir(&app)?;
    theme_store::read_manifest(&dir).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_theme_manifest(app: AppHandle, content: String) -> Result<(), String> {
    let dir = app_data_dir(&app)?;
    theme_store::write_manifest(&dir, &content).map_err(|error| error.to_string())
}

#[tauri::command]
async fn open_lark_install_directory() -> Result<(), String> {
    blocking(|| with_lark_path(process::reveal)).await
}

#[tauri::command]
async fn check_lark_write_access() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return blocking(|| {
        with_lark_path(|path| {
            use crate::utils::lark::macos::{access, installation::Installation};
            let installation = Installation::open(path)?;
            access::probe_directory(&installation.resources.join("webcontent"))?;
            Ok(())
        })
    })
    .await;
    #[cfg(not(target_os = "macos"))]
    Ok(())
}

#[tauri::command]
async fn open_app_management_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return blocking(crate::utils::lark::macos::access::open_settings).await;
    #[cfg(not(target_os = "macos"))]
    Err("此设置仅适用于 macOS".into())
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
        .plugin(tauri_plugin_process::init())
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
            check_lark_write_access,
            open_app_management_settings,
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
