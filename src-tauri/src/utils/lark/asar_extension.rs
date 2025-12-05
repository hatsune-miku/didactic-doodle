use std::{collections::BTreeMap, path::PathBuf};

use crate::error::{WalError, WalResult};

pub trait AsarPatch {
    fn patching(
        reader: &asar::AsarReader,
        custom_files: &BTreeMap<PathBuf, Vec<u8>>,
    ) -> WalResult<asar::AsarWriter>;
}

impl AsarPatch for asar::AsarWriter {
    fn patching(
        reader: &asar::AsarReader,
        custom_files: &BTreeMap<PathBuf, Vec<u8>>,
    ) -> WalResult<asar::AsarWriter> {
        let mut writer = Self::new();
        for (path, file) in reader.files() {
            let custom_file = custom_files.iter().find(|(p, _)| *p == path);
            if let Some((custom_path, custom_data)) = custom_file {
                writer
                    .write_file(custom_path, custom_data, false)
                    .map_err(|_| WalError::IoError)?;
            } else {
                writer
                    .write_file(path, file.data(), false)
                    .map_err(|_| WalError::IoError)?;
            }
        }
        Ok(writer)
    }
}
