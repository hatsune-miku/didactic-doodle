use std::path::PathBuf;

use crate::{
    error::{WalError, WalResult},
    info,
    utils::lark::patch::PatchUnit,
};

pub trait AsarPatch {
    fn from_reader_with_patches<'a, I>(
        reader: &asar::AsarReader,
        patch_units: I,
    ) -> WalResult<asar::AsarWriter>
    where
        I: IntoIterator<Item = &'a PatchUnit>,
        I::IntoIter: Clone;
}

impl AsarPatch for asar::AsarWriter {
    fn from_reader_with_patches<'a, I>(
        reader: &asar::AsarReader,
        patch_units: I,
    ) -> WalResult<asar::AsarWriter>
    where
        I: IntoIterator<Item = &'a PatchUnit>,
        I::IntoIter: Clone,
    {
        info!("creating asar writer with patches...");
        let mut writer = Self::new();
        let iter = patch_units.into_iter();

        for (path, file) in reader.files() {
            let unit = iter.clone().find(|unit| unit.path == *path);
            if let Some(unit) = unit {
                writer
                    .write_file(unit.path.as_path(), &unit.data, false)
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
