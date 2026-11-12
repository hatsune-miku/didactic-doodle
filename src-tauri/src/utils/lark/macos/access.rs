use std::{io, os::unix::fs::MetadataExt, path::Path, process::Command};

use crate::error::{WalError, WalResult};

#[derive(Debug, PartialEq)]
pub enum WriteAccess {
    Writable(u32),
    AdministratorRequired,
}

fn probe_error(error: io::Error) -> WalResult<WriteAccess> {
    match error.raw_os_error() {
        // macOS app-bundle protection returns EPERM. Elevation does not grant
        // App Management consent, so stop before showing an administrator prompt.
        Some(1) => Err(WalError::AppManagementRequired),
        // EACCES can be ordinary Unix ownership/ACLs and still needs elevation.
        Some(13) => Ok(WriteAccess::AdministratorRequired),
        _ => Err(error.into()),
    }
}

pub fn probe_directory(directory: &Path) -> WalResult<WriteAccess> {
    match tempfile::Builder::new()
        .prefix(".wal-access-")
        .tempfile_in(directory)
    {
        Ok(probe) => {
            // Check actual write access without changing any existing resource.
            let uid = probe.as_file().metadata()?.uid();
            probe.close().map_err(WalError::from)?;
            Ok(WriteAccess::Writable(uid))
        }
        Err(error) => probe_error(error),
    }
}

pub fn write_error(stderr: &str) -> WalError {
    if stderr.contains("(-128)") {
        WalError::Message("已取消管理员授权，未完成写入".into())
    } else if stderr.contains("Operation not permitted") {
        WalError::AppManagementRequired
    } else {
        WalError::Message(format!("写入飞书资源失败: {}", stderr.trim()))
    }
}

pub fn open_settings() -> WalResult<()> {
    let status = Command::new("/usr/bin/open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AppBundles")
        .status()?;
    if !status.success() {
        return Err(WalError::Message(
            "无法打开系统设置，请前往隐私与安全性 → App 管理".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn separates_app_protection_from_unix_permissions_and_other_errors() {
        assert!(matches!(
            probe_error(io::Error::from_raw_os_error(1)),
            Err(WalError::AppManagementRequired)
        ));
        assert_eq!(
            probe_error(io::Error::from_raw_os_error(13)).unwrap(),
            WriteAccess::AdministratorRequired
        );
        assert!(probe_error(io::Error::from_raw_os_error(2)).is_err());
        assert!(probe_error(io::Error::from_raw_os_error(28)).is_err());
    }

    #[test]
    fn probe_removes_its_temporary_file_and_preserves_existing_files() {
        let directory = tempfile::tempdir().unwrap();
        let original = directory.path().join("existing.asar");
        std::fs::write(&original, b"original").unwrap();
        assert!(matches!(
            probe_directory(directory.path()).unwrap(),
            WriteAccess::Writable(_)
        ));
        assert_eq!(std::fs::read(&original).unwrap(), b"original");
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
        assert!(probe_directory(&directory.path().join("missing")).is_err());
    }

    #[test]
    fn recognizes_protection_after_elevation_without_hiding_other_failures() {
        assert!(matches!(
            write_error("mkdir: /Applications/Lark.app/stage: Operation not permitted"),
            WalError::AppManagementRequired
        ));
        assert!(write_error("User canceled. (-128)")
            .to_string()
            .contains("已取消"));
        assert!(write_error("No space left on device")
            .to_string()
            .contains("No space left"));
    }
}
