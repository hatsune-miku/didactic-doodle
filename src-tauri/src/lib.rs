use tauri::{Error, Manager};

use crate::{shared::LARK_HELPER, utils::lark::find::LarkFinder};

pub mod shared;
pub mod utils;

#[tauri::command]
fn get_lark_path() -> tauri::Result<String> {
    let mut helper = match LARK_HELPER.lock() {
        Ok(helper) => helper,
        Err(e) => return Err(Error::UnknownPath),
    };

    match helper.locate() {
        Ok(path) => Ok(path),
        Err(e) => Err(e.into()),
    }
}

fn is_debug() -> bool {
    tauri::is_dev()
}

fn setup_debug(app: &mut tauri::App) {
    let windows_map = app.webview_windows();
    let windows = windows_map.values().collect::<Vec<_>>();
    windows.iter().for_each(|w| w.open_devtools());
}

fn setup(app: &mut tauri::App) -> Result<(), Error> {
    if is_debug() {
        setup_debug(app);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(setup)
        .invoke_handler(tauri::generate_handler![get_lark_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
