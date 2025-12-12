use std::{cmp::Ordering, fs, path::PathBuf};

use crate::{
    error::{WalError, WalResult},
    utils::platform::os::{join_components, utf8_bytes_to_string},
};

#[derive(Clone, Debug)]
pub struct LarkAsarFile {
    base_path: String,
    asar_path: String,
    asar_binary: Vec<u8>,
    asar_absolute_path: String,
}

impl PartialEq for LarkAsarFile {
    fn eq(&self, other: &Self) -> bool {
        self.asar_absolute_path == other.asar_absolute_path
    }
}

impl Eq for LarkAsarFile {}

impl PartialOrd for LarkAsarFile {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.asar_absolute_path.cmp(&other.asar_absolute_path))
    }
}

impl Ord for LarkAsarFile {
    fn cmp(&self, other: &Self) -> Ordering {
        self.asar_absolute_path.cmp(&other.asar_absolute_path)
    }
}

impl LarkAsarFile {
    pub fn new(base_path: String, asar_path: String) -> WalResult<Self> {
        let asar_absolute_path = join_components(&[&base_path, &asar_path])?;
        let asar_binary = fs::read(&asar_absolute_path).map_err(|_| WalError::IoError)?;

        Ok(Self {
            base_path,
            asar_path,
            asar_absolute_path,
            asar_binary,
        })
    }

    pub fn get_main_script_path(&self, subject: &str) -> WalResult<PathBuf> {
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
            Some(path) => Ok(PathBuf::from(path)),
            None => Err(WalError::AsarStructureError),
        }
    }

    pub fn get_main_script_content(&self, subject: &str) -> WalResult<String> {
        let path = self.get_main_script_path(subject)?;
        self.read_string(&path)
    }

    pub fn read_string(&self, path: &PathBuf) -> WalResult<String> {
        let content = self.read(path)?;
        Ok(utf8_bytes_to_string(&content))
    }

    pub fn read(&self, path: &PathBuf) -> WalResult<Vec<u8>> {
        let reader = self.create_reader()?;
        let file = reader.read(path).ok_or(WalError::IoError)?;
        Ok(file.data().to_vec())
    }

    pub fn create_reader<'a>(&'a self) -> WalResult<asar::AsarReader<'a>> {
        create_reader(&self.asar_binary)
    }

    pub fn asar_absolute_path(&self) -> &str {
        &self.asar_absolute_path
    }
}

fn create_reader<'a>(data_raw: &'a [u8]) -> WalResult<asar::AsarReader<'a>> {
    asar::AsarReader::new(&data_raw, None).map_err(|_| WalError::IoError)
}
