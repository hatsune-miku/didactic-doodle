use std::{
    collections::{BTreeMap, HashSet},
    fs,
    path::PathBuf,
    sync::{Arc, LazyLock, Mutex},
};

use asar::AsarWriter;

use crate::{
    error::{WalError, WalResult},
    info,
    shared::lark_helper_session,
    utils::{
        file::{self, backup::create_backup},
        lark::{
            asar_extension::AsarPatch,
            file::LarkAsarFile,
            find::LarkFinder,
            patch::{LarkAsarPatch, PatchUnit},
        },
    },
};

static SESSIONS: LazyLock<Mutex<Vec<Arc<Mutex<LarkSession>>>>> =
    LazyLock::new(|| Mutex::new(Vec::new()));

pub fn create_lark_session() -> WalResult<Arc<Mutex<LarkSession>>> {
    let session = LarkSession::new();
    let session = Arc::new(Mutex::new(session));
    SESSIONS
        .lock()
        .map_err(|_| WalError::LockError)?
        .push(session.clone());
    Ok(session)
}

pub fn get_lark_session(id: &str) -> Option<Arc<Mutex<LarkSession>>> {
    let sessions = SESSIONS.lock().ok()?;
    sessions
        .iter()
        .find(|session| match session.lock() {
            Ok(session) => session.id() == id,
            Err(_) => false,
        })
        .cloned()
}

pub fn close_lark_session(id: &str) -> WalResult<()> {
    let mut sessions = SESSIONS.lock().map_err(|_| WalError::LockError)?;
    let index = sessions
        .iter()
        .position(|s| match s.lock() {
            Ok(session) => session.id() == id,
            Err(_) => false,
        })
        .ok_or(WalError::SessionNotFoundError)?;
    sessions.remove(index);
    Ok(())
}

pub fn interpret_command(session_id: &str, command: &str, args: Vec<String>) -> WalResult<String> {
    let session = get_lark_session(session_id).ok_or(WalError::SessionNotFoundError)?;
    let mut session = session.lock().map_err(|_| WalError::LockError)?;
    match command {
        "submit_patch" => {
            session.submit_patch(args[0].as_str(), args[1].as_str(), args[2].as_str())?;
            Ok("patch submitted".to_string())
        }
        "apply_patches" => {
            session.apply_patches()?;
            Ok("patches applied".to_string())
        }
        "submit_main_script_patch" => {
            session.submit_main_script_patch(
                args[0].as_str(),
                args[1].as_str(),
                args[2].as_str(),
            )?;
            Ok("main script patch submitted".to_string())
        }
        "backup_exists" => {
            let exists = session.backup_exists(args[0].as_str())?;
            Ok(if exists { "true" } else { "false" }.to_string())
        }
        "restore_backup" => {
            session.restore_backup(args[0].as_str())?;
            Ok("backup restored".to_string())
        }
        "create_backup" => {
            session.create_backup(args[0].as_str())?;
            Ok("backup created".to_string())
        }
        "find_backups" => {
            let backups = session.find_backups()?;
            Ok(backups.join(",").to_string())
        }
        "restore_all_backups" => {
            session.restore_all_backups()?;
            Ok("all backups restored".to_string())
        }
        _ => Err(WalError::InvalidCommandError),
    }
}

pub struct LarkSession {
    id: String,
    patch_map: BTreeMap<LarkAsarFile, HashSet<PatchUnit>>,
}

impl LarkSession {
    pub fn new() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            patch_map: BTreeMap::new(),
        }
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn submit_patch(
        &mut self,
        asar_path: &str,
        inner_path: &str,
        script: &str,
    ) -> WalResult<()> {
        lark_helper_session(|helper| {
            let base_path = helper.locate()?;
            let file = LarkAsarFile::new(base_path, asar_path.to_owned())?;
            let patch = file.patch_script(&PathBuf::from(inner_path), script)?;
            if self.patch_map.contains_key(&file) {
                self.patch_map.get_mut(&file).unwrap().replace(patch);
            } else {
                let mut set = HashSet::new();
                set.insert(patch);
                self.patch_map.insert(file, set);
            }
            Ok(())
        })
    }

    pub fn submit_main_script_patch(
        &mut self,
        asar_path: &str,
        subject: &str,
        script: &str,
    ) -> WalResult<()> {
        lark_helper_session(|helper| {
            let base_path = helper.locate()?;
            let file = LarkAsarFile::new(base_path, asar_path.to_owned())?;
            let inner_path = file.get_main_script_path(subject)?;
            let patch = file.patch_script(&inner_path, script)?;
            info!("found main script: {}/{}", subject, inner_path.display());

            if self.patch_map.contains_key(&file) {
                self.patch_map.get_mut(&file).unwrap().insert(patch);
            } else {
                let mut set = HashSet::new();
                set.insert(patch);
                self.patch_map.insert(file, set);
            }
            Ok(())
        })
    }

    pub fn apply_patches(&self) -> WalResult<()> {
        for (file, patches) in self.patch_map.iter() {
            let reader = file.create_reader()?;
            let patched_writer = AsarWriter::from_reader_with_patches(&reader, patches)?;
            let target_file = file.asar_absolute_path();
            create_backup(target_file)?;
            let file = fs::File::create(target_file).map_err(|_| WalError::IoError)?;
            patched_writer
                .finalize(file)
                .map_err(|_| WalError::IoError)?;
        }
        Ok(())
    }

    pub fn backup_exists(&self, path: &str) -> WalResult<bool> {
        file::backup::backup_exists(path)
    }

    pub fn restore_backup(&self, path: &str) -> WalResult<()> {
        file::backup::restore_backup(path)
    }

    pub fn create_backup(&self, path: &str) -> WalResult<()> {
        file::backup::create_backup(path)
    }

    pub fn find_backups(&self) -> WalResult<Vec<String>> {
        let base_path = lark_helper_session(|helper| helper.locate())?;
        file::backup::find_backups_recursively(&base_path)
    }

    pub fn restore_all_backups(&self) -> WalResult<()> {
        let base_path = lark_helper_session(|helper| helper.locate())?;
        file::backup::restore_all_backups_recursively(&base_path)
    }
}
