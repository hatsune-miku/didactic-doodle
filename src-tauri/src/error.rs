#[derive(Debug)]
pub enum WalError {
    LockError,
    IoError,
    RegistryError,
    SystemEncodingError,
    AsarStructureError,
    PatternNotFoundError,
    SessionNotFoundError,
    InvalidCommandError,
    AlreadyPatchedError,
    AppManagementRequired,
    Message(String),
}

#[cfg(target_os = "windows")]
impl From<windows_result::Error> for WalError {
    fn from(_: windows_result::Error) -> Self {
        WalError::RegistryError
    }
}

impl std::fmt::Display for WalError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::AppManagementRequired => f.write_str(
                "APP_MANAGEMENT_REQUIRED: 请在系统设置 → 隐私与安全性 → App 管理中允许 wal-assistant-lark 修改其他应用，然后重试",
            ),
            Self::Message(message) => f.write_str(message),
            _ => write!(f, "{self:?}"),
        }
    }
}

impl From<std::io::Error> for WalError {
    fn from(error: std::io::Error) -> Self {
        Self::Message(error.to_string())
    }
}

pub type WalResult<T, R = WalError> = Result<T, R>;

pub fn make_tauri_result<T>(result: WalResult<T>) -> Result<T, String> {
    result.map_err(|error| error.to_string())
}
