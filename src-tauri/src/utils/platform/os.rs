use std::path::PathBuf;

use crate::error::{WalError, WalResult};

pub fn wide_to_string_utf16(buf: &[u16]) -> String {
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..len])
}

pub fn utf8_bytes_to_string(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).to_string()
}

pub fn join_components(components: &[&str]) -> WalResult<String> {
    components
        .iter()
        .collect::<PathBuf>()
        .into_os_string()
        .into_string()
        .map_err(|_| WalError::SystemEncodingError)
}
