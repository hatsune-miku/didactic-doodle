use std::{fs, path::PathBuf};

use crate::{
    error::{WalError, WalResult},
    utils::platform::os::{join_components, utf8_bytes_to_string},
};

pub struct LarkPatch {
    data_raw: Vec<u8>,
    asar_writer: asar::AsarWriter,
}

impl LarkPatch {
    pub fn new(lark_path: &str) -> WalResult<Self> {
        let asar_path = join_components(&[&lark_path, "webcontent", "messenger.asar"])?;
        let data_raw = fs::read(asar_path).unwrap();
        Ok(Self {
            data_raw,
            asar_writer: asar::AsarWriter::new(),
        })
    }

    fn create_reader<'a>(&'a self) -> WalResult<asar::AsarReader<'a>> {
        asar::AsarReader::new(&self.data_raw, None).map_err(|_| WalError::IoError)
    }

    pub fn get_messenger_chat_script_path(&self) -> WalResult<String> {
        let asar_reader = self.create_reader()?;
        let entry_iter = match asar_reader.read_dir(&PathBuf::from("messenger-chat")) {
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

    pub fn get_messenger_chat_script_content(&self) -> WalResult<String> {
        let path = self.get_messenger_chat_script_path()?;
        let asar_reader = self.create_reader()?;
        let content = asar_reader.read(&PathBuf::from(path)).unwrap().data();
        Ok(utf8_bytes_to_string(content))
    }

    pub fn patch(&self) -> WalResult<()> {
        Ok(())
    }
}
