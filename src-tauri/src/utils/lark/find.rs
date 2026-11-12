#[cfg(target_os = "windows")]
use std::fs;

use crate::{
    error::{WalError, WalResult},
    utils::lark::lark::Lark,
};

#[cfg(target_os = "windows")]
use crate::{info, utils::platform::os::join_components};

pub trait LarkFinder {
    fn locate(&mut self) -> WalResult<String>;
}

impl LarkFinder for Lark {
    fn locate(&mut self) -> WalResult<String> {
        match self.get_path() {
            Some(path) if std::path::Path::new(&path).is_dir() => Ok(path),
            _ => match find_lark_path() {
                Ok(path) => {
                    self.set_path(&path);
                    Ok(path)
                }
                Err(e) => Err(e),
            },
        }
    }
}

// HKCU\Software\Feishu\InstallDir
#[cfg(target_os = "windows")]
fn find_lark_path() -> WalResult<String> {
    let key = windows_registry::CURRENT_USER.open("Software\\Feishu")?;
    let install_dir = key.get_string("InstallDir")?;
    let lark_ini_path = join_components(&[&install_dir, "lark.ini"])?;
    let lark_ini_content = fs::read_to_string(&lark_ini_path).map_err(|_| WalError::IoError)?;
    let lark_ini_content = lark_ini_content.trim();

    info!("lark active version: {}", lark_ini_content);
    join_components(&[&install_dir, &lark_ini_content])
}

#[cfg(target_os = "macos")]
fn find_lark_path() -> WalResult<String> {
    super::macos::installation::locate().and_then(|path| {
        path.into_os_string()
            .into_string()
            .map_err(|_| WalError::SystemEncodingError)
    })
}
