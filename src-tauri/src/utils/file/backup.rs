use std::fs;

use crate::error::{WalError, WalResult};

pub fn make_backup_path(path: &str) -> String {
    let backup_path = format!("{}.bak", path);
    backup_path
}

pub fn backup_exists(path: &str) -> WalResult<bool> {
    let backup_path = make_backup_path(path);
    fs::exists(&backup_path).map_err(|_| WalError::IoError)
}

pub fn restore_backup(path: &str) -> WalResult<()> {
    let backup_path = make_backup_path(path);
    if !backup_exists(path)? {
        return Err(WalError::IoError);
    }
    fs::copy(&backup_path, path).map_err(|_| WalError::IoError)?;
    fs::remove_file(&backup_path).map_err(|_| WalError::IoError)?;
    Ok(())
}

pub fn create_backup(path: &str) -> WalResult<()> {
    let backup_path = make_backup_path(path);
    if backup_exists(path)? {
        return Ok(());
    }
    fs::copy(path, &backup_path).map_err(|_| WalError::IoError)?;
    Ok(())
}
