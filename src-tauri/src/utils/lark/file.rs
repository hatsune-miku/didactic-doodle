use std::{fs, path::PathBuf};

use crate::{
    error::{WalError, WalResult},
    utils::platform::os::{join_components, utf8_bytes_to_string},
};

pub struct LarkFile {
    base_path: String,
    asar_name: String,
    path: PathBuf,
    asar_binary: Vec<u8>,
    asar_absolute_path: String,
    is_directory: bool,
}

impl LarkFile {
    pub fn new(
        base_path: String,
        asar_name: String,
        path: String,
        is_directory: bool,
    ) -> WalResult<Self> {
        let asar_absolute_path = join_components(&[&base_path, &asar_name])?;
        let asar_binary = fs::read(&asar_absolute_path).map_err(|_| WalError::IoError)?;
        let path = PathBuf::from(&path);

        Ok(Self {
            base_path,
            asar_name,
            path,
            asar_absolute_path,
            is_directory,
            asar_binary,
        })
    }

    pub fn get_main_script_path(&self, subject: &str) -> WalResult<String> {
        let asar_reader = self.create_reader()?;
        let entry_iter = match asar_reader.read_dir(&PathBuf::from(subject)) {
            Some(entries) => entries.iter(),
            None => return Err(WalError::IoError),
        };
        match entry_iter
            .map(|path| {
                path.clone()
                    .into_os_string()
                    .into_string()
                    .unwrap_or("".to_string())
            })
            .filter(|path| path.to_lowercase().ends_with(".js"))
            .next()
        {
            Some(path) => Ok(path),
            None => Err(WalError::AsarStructureError),
        }
    }

    pub fn get_main_script_content(&self, subject: &str) -> WalResult<String> {
        let path = self.get_main_script_path(subject)?;
        let asar_reader = self.create_reader()?;
        let content = asar_reader.read(&PathBuf::from(path)).unwrap().data();
        Ok(utf8_bytes_to_string(content))
    }

    pub fn read(&self, path: &str) -> WalResult<Vec<u8>> {
        let reader = self.create_reader()?;
        let file = reader.read(&PathBuf::from(path)).ok_or(WalError::IoError)?;
        Ok(file.data().to_vec())
    }

    fn create_reader<'a>(&'a self) -> WalResult<asar::AsarReader<'a>> {
        create_reader(&self.asar_binary)
    }
}

fn create_reader<'a>(data_raw: &'a [u8]) -> WalResult<asar::AsarReader<'a>> {
    asar::AsarReader::new(&data_raw, None).map_err(|_| WalError::IoError)
}
