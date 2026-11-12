#[cfg(target_os = "windows")]
use std::fs;
use std::{
    collections::{BTreeMap, HashSet},
    path::PathBuf,
    sync::{Arc, LazyLock, Mutex},
};

use crate::{
    error::{WalError, WalResult},
    shared::lark_helper_session,
    utils::lark::{
        file::LarkAsarFile,
        find::LarkFinder,
        patch::{LarkAsarPatch, PatchUnit},
    },
};

#[cfg(target_os = "windows")]
use crate::utils::file::{self, backup::create_backup};
#[cfg(target_os = "macos")]
use crate::utils::lark::macos::{
    installation::Installation,
    storage::{default_backup_root, Store},
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
    let _operation = crate::shared::lock_lark_operation()?;
    let session = get_lark_session(session_id).ok_or(WalError::SessionNotFoundError)?;
    let mut session = session.lock().map_err(|_| WalError::LockError)?;
    let expected_args = match command {
        "submit_patch" | "submit_main_script_patch" => 3,
        "backup_exists" | "restore_backup" | "create_backup" => 1,
        "apply_patches" | "find_backups" | "restore_all_backups" => 0,
        _ => return Err(WalError::InvalidCommandError),
    };
    if args.len() != expected_args {
        return Err(WalError::InvalidCommandError);
    }
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
    #[cfg(target_os = "macos")]
    store: Option<Store>,
    #[cfg(target_os = "macos")]
    backup_root: Option<PathBuf>,
}

impl LarkSession {
    pub fn new() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            patch_map: BTreeMap::new(),
            #[cfg(target_os = "macos")]
            store: None,
            #[cfg(target_os = "macos")]
            backup_root: None,
        }
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    #[cfg(target_os = "macos")]
    fn store(&mut self) -> WalResult<&Store> {
        if self.store.is_none() {
            let app = lark_helper_session(|helper| helper.locate())?;
            let installation = Installation::open(std::path::Path::new(&app))?;
            let root = match &self.backup_root {
                Some(root) => root.clone(),
                None => default_backup_root()?,
            };
            self.store = Some(Store::new(installation, &root));
        }
        let store = self.store.as_ref().unwrap();
        store.installation.check_unchanged()?;
        Ok(store)
    }

    #[cfg(all(test, target_os = "macos"))]
    pub(super) fn with_backup_root(root: PathBuf) -> Self {
        Self {
            backup_root: Some(root),
            ..Self::new()
        }
    }

    pub fn submit_patch(
        &mut self,
        asar_path: &str,
        inner_path: &str,
        script: &str,
    ) -> WalResult<()> {
        #[cfg(target_os = "macos")]
        self.store()?;
        lark_helper_session(|helper| {
            let base_path = helper.locate()?;
            let file = LarkAsarFile::new(base_path, asar_path.to_owned())?;
            let patch = file.patch_script(&PathBuf::from(inner_path.replace('\\', "/")), script)?;
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
        #[cfg(target_os = "macos")]
        self.store()?;
        lark_helper_session(|helper| {
            let base_path = helper.locate()?;
            let file = LarkAsarFile::new(base_path, asar_path.to_owned())?;
            let inner_path = file.get_main_script_path(subject)?;
            let patch = file.patch_script(&inner_path, script)?;

            if self.patch_map.contains_key(&file) {
                // 用 replace 而非 insert：HashSet::insert 不会覆盖已存在的相等元素，
                // 会导致同一文件被重复提交时保留旧补丁内容。
                self.patch_map.get_mut(&file).unwrap().replace(patch);
            } else {
                let mut set = HashSet::new();
                set.insert(patch);
                self.patch_map.insert(file, set);
            }
            Ok(())
        })
    }

    pub fn apply_patches(&mut self) -> WalResult<()> {
        // Consume the batch even on failure: a later operation must never replay it
        // or reuse archive bytes from before a restore/update.
        let patch_map = std::mem::take(&mut self.patch_map);
        if patch_map.is_empty() {
            return Ok(());
        }
        let base = lark_helper_session(|helper| helper.locate())?;
        crate::utils::platform::process::require_stopped(std::path::Path::new(&base))?;
        #[cfg(target_os = "macos")]
        {
            let files = patch_map
                .iter()
                .map(|(file, patches)| {
                    Ok((
                        PathBuf::from(file.asar_absolute_path()),
                        file.patched(patches)?,
                        file.source_hash(),
                    ))
                })
                .collect::<WalResult<Vec<_>>>()?;
            return self.store()?.apply(&files);
        }
        #[cfg(target_os = "windows")]
        for (file, patches) in patch_map.iter() {
            use sha2::{Digest, Sha256};
            use std::io::Write;
            let data = file.patched(patches)?;
            let target_file = file.asar_absolute_path();
            if format!("{:x}", Sha256::digest(fs::read(target_file)?)) != file.source_hash() {
                return Err(WalError::Message(
                    "准备补丁后飞书资源发生变化，请重试".into(),
                ));
            }
            create_backup(target_file)?;
            let parent = std::path::Path::new(target_file)
                .parent()
                .ok_or(WalError::IoError)?;
            let mut temporary = tempfile::NamedTempFile::new_in(parent)?;
            temporary.write_all(&data)?;
            temporary.as_file().sync_all()?;
            crate::utils::platform::process::require_stopped(std::path::Path::new(&base))?;
            temporary
                .persist(target_file)
                .map_err(|error| WalError::from(error.error))?;
        }
        #[cfg(target_os = "windows")]
        Ok(())
    }

    pub fn backup_exists(&mut self, path: &str) -> WalResult<bool> {
        #[cfg(target_os = "macos")]
        {
            return self.store()?.backup_exists(std::path::Path::new(path));
        }
        #[cfg(target_os = "windows")]
        file::backup::backup_exists(path)
    }

    pub fn restore_backup(&mut self, path: &str) -> WalResult<()> {
        self.patch_map.clear();
        #[cfg(target_os = "macos")]
        {
            return self.store()?.restore(&[PathBuf::from(path)]);
        }
        #[cfg(target_os = "windows")]
        file::backup::restore_backup(path)
    }

    pub fn create_backup(&mut self, path: &str) -> WalResult<()> {
        #[cfg(target_os = "macos")]
        {
            return self.store()?.create_backup(std::path::Path::new(path));
        }
        #[cfg(target_os = "windows")]
        file::backup::create_backup(path)
    }

    pub fn find_backups(&mut self) -> WalResult<Vec<String>> {
        #[cfg(target_os = "macos")]
        {
            return Ok(self
                .store()?
                .targets()?
                .iter()
                .map(|path| path.to_string_lossy().into_owned())
                .collect());
        }
        #[cfg(target_os = "windows")]
        {
            let base_path = lark_helper_session(|helper| helper.locate())?;
            file::backup::find_backups_recursively(&base_path)
        }
    }

    pub fn restore_all_backups(&mut self) -> WalResult<()> {
        self.patch_map.clear();
        #[cfg(target_os = "macos")]
        {
            let store = self.store()?;
            return store.restore(&store.targets()?);
        }
        #[cfg(target_os = "windows")]
        {
            let base_path = lark_helper_session(|helper| helper.locate())?;
            crate::utils::platform::process::require_stopped(std::path::Path::new(&base_path))?;
            file::backup::restore_all_backups_recursively(&base_path)
        }
    }
}
