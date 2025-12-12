use std::fs;

use crate::{
    error::{WalError, WalResult},
    info,
    utils::{lark::lark::Lark, platform::os::join_components},
};

pub trait LarkFinder {
    fn locate(&mut self) -> WalResult<String>;
}

impl LarkFinder for Lark {
    fn locate(&mut self) -> WalResult<String> {
        match self.get_path() {
            Some(path) => Ok(path),
            None => match find_lark_path() {
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
fn find_lark_path() -> WalResult<String> {
    let key = windows_registry::CURRENT_USER.open("Software\\Feishu")?;
    let install_dir = key.get_string("InstallDir")?;
    let lark_ini_path = join_components(&[&install_dir, "lark.ini"])?;
    let lark_ini_content = fs::read_to_string(&lark_ini_path).map_err(|_| WalError::IoError)?;
    let lark_ini_content = lark_ini_content.trim();

    info!("lark active version: {}", lark_ini_content);
    join_components(&[&install_dir, &lark_ini_content])
}
