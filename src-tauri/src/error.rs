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
}

impl From<windows_result::Error> for WalError {
    fn from(_: windows_result::Error) -> Self {
        WalError::RegistryError
    }
}

pub type WalResult<T, R = WalError> = Result<T, R>;

pub fn make_tauri_result<T>(result: WalResult<T>) -> tauri::Result<T> {
    result.map_err(|_| tauri::Error::InvokeKey)
}
