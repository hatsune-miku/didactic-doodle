use std::fs;

use crate::error::{WalError, WalResult};

pub fn make_backup_path(path: &str) -> String {
    let backup_path = format!("{}.wal-backup", path);
    backup_path
}

pub fn reverse_make_backup_path(path: &str) -> String {
    if path.contains(".wal-backup") {
        path.replace(".wal-backup", "")
    } else {
        path.to_string()
    }
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

pub fn find_backups_recursively(path: &str) -> WalResult<Vec<String>> {
    let mut backups = Vec::new();
    for entry in fs::read_dir(path).map_err(|_| WalError::IoError)? {
        let entry = entry.map_err(|_| WalError::IoError)?;
        let path = entry.path();
        let path_string = path.to_string_lossy().to_string();
        if path.is_file() && path.extension().unwrap_or_default() == "wal-backup" {
            backups.push(path_string);
        } else if path.is_dir() {
            backups.extend(find_backups_recursively(&path_string)?);
        }
    }
    Ok(backups)
}

pub fn restore_all_backups_recursively(path: &str) -> WalResult<()> {
    let backups = find_backups_recursively(path)?;
    for backup in backups {
        restore_backup(&reverse_make_backup_path(&backup))?;
    }
    Ok(())
}
