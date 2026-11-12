use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
};

use asar::AsarWriter;

use super::session::LarkSession;
use crate::{
    shared::get_lark_helper,
    utils::lark::{file::LarkAsarFile, lark::Lark},
};

// The application locator is global. Give each test its own installation directory.
static TEST_LOCK: Mutex<()> = Mutex::new(());

struct Installation {
    root: PathBuf,
    app: PathBuf,
    #[cfg(target_os = "macos")]
    fixture: crate::utils::lark::macos::test_support::Fixture,
    previous_helper: Option<Lark>,
    _guard: MutexGuard<'static, ()>,
}

impl Installation {
    fn new() -> Self {
        let guard = TEST_LOCK.lock().unwrap_or_else(|error| error.into_inner());
        #[cfg(target_os = "windows")]
        let root = {
            let root =
                std::env::temp_dir().join(format!("wal-patch-test-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&root).unwrap();
            root.canonicalize().unwrap()
        };
        #[cfg(target_os = "windows")]
        let app = root.clone();
        #[cfg(target_os = "macos")]
        let fixture = crate::utils::lark::macos::test_support::Fixture::new();
        #[cfg(target_os = "macos")]
        let (root, app) = (
            fixture.installation.resources.clone(),
            fixture.installation.app.clone(),
        );
        let mut helper = get_lark_helper().unwrap();
        let previous_helper = std::mem::replace(&mut *helper, Lark::new());
        helper.set_path(&app.to_str().unwrap().to_owned());
        drop(helper);

        let installation = Self {
            root,
            app,
            #[cfg(target_os = "macos")]
            fixture,
            previous_helper: Some(previous_helper),
            _guard: guard,
        };
        installation.write_archive("a.asar", "original");
        installation.write_archive("b.asar", "original");
        installation
    }

    fn session(&self) -> LarkSession {
        #[cfg(target_os = "windows")]
        {
            LarkSession::new()
        }
        #[cfg(target_os = "macos")]
        {
            LarkSession::with_backup_root(self.fixture.backups.clone())
        }
    }

    fn write_archive(&self, name: &str, marker: &str) {
        let mut writer = AsarWriter::new();
        for path in ["main/index.js", "other/index.js"] {
            writer
                .write_file(
                    Path::new(path),
                    format!("\"use strict\";\n// {marker}\n").as_bytes(),
                    false,
                )
                .unwrap();
        }
        writer
            .finalize(fs::File::create(self.root.join(name)).unwrap())
            .unwrap();
    }

    fn read(&self, archive: &str, path: &str) -> String {
        LarkAsarFile::new(self.app.to_str().unwrap().to_owned(), archive.to_owned())
            .unwrap()
            .read_string(&PathBuf::from(path))
            .unwrap()
    }
}

impl Drop for Installation {
    fn drop(&mut self) {
        *get_lark_helper().unwrap() = self.previous_helper.take().unwrap();
        let _ = fs::remove_dir_all(&self.root);
    }
}

#[test]
fn main_script_resubmission_uses_the_latest_patch() {
    let installation = Installation::new();
    let mut session = installation.session();
    session
        .submit_main_script_patch("a.asar", "main", "OLD_PATCH")
        .unwrap();
    session
        .submit_main_script_patch("a.asar", "main", "NEW_PATCH")
        .unwrap();
    session.apply_patches().unwrap();

    let content = installation.read("a.asar", "main/index.js");
    assert!(content.contains("NEW_PATCH"));
    assert!(!content.contains("OLD_PATCH"));
}

#[test]
fn applying_again_after_restore_drops_disabled_targets_and_reads_fresh_contents() {
    let installation = Installation::new();
    let mut session = installation.session();
    session
        .submit_main_script_patch("a.asar", "main", "OLD_MAIN")
        .unwrap();
    session
        .submit_patch("a.asar", "other/index.js", "DISABLED_FILE")
        .unwrap();
    session
        .submit_main_script_patch("b.asar", "main", "DISABLED_ARCHIVE")
        .unwrap();
    session.apply_patches().unwrap();
    session.restore_all_backups().unwrap();

    installation.write_archive("a.asar", "fresh original");
    #[cfg(target_os = "macos")]
    {
        installation.fixture.update_version();
        session = installation.session();
    }
    session
        .submit_main_script_patch("a.asar", "main", "NEW_MAIN")
        .unwrap();
    session.apply_patches().unwrap();

    let main = installation.read("a.asar", "main/index.js");
    assert!(main.contains("NEW_MAIN"));
    assert!(main.contains("fresh original"));
    assert!(!main.contains("OLD_MAIN"));
    assert!(!installation
        .read("a.asar", "other/index.js")
        .contains("DISABLED_FILE"));
    assert!(!installation
        .read("b.asar", "main/index.js")
        .contains("DISABLED_ARCHIVE"));
}

#[test]
fn applying_consumes_the_pending_patches() {
    let installation = Installation::new();
    let mut session = installation.session();
    session
        .submit_patch("a.asar", "main/index.js", "OLD_PATCH")
        .unwrap();
    session.apply_patches().unwrap();
    // Restore outside the session so this test specifically checks apply's cleanup.
    installation
        .session()
        .restore_backup(installation.root.join("a.asar").to_str().unwrap())
        .unwrap();
    session.apply_patches().unwrap();

    assert!(!installation
        .read("a.asar", "main/index.js")
        .contains("OLD_PATCH"));
}

#[test]
fn restoring_all_backups_discards_unapplied_patches() {
    let installation = Installation::new();
    let mut session = installation.session();
    session
        .submit_patch("a.asar", "main/index.js", "ABANDONED_PATCH")
        .unwrap();
    session.restore_all_backups().unwrap();
    session.apply_patches().unwrap();

    assert!(!installation
        .read("a.asar", "main/index.js")
        .contains("ABANDONED_PATCH"));
}

#[test]
fn restoring_one_backup_discards_unapplied_patches() {
    let installation = Installation::new();
    let path = installation.root.join("a.asar");
    installation
        .session()
        .create_backup(path.to_str().unwrap())
        .unwrap();
    let mut session = installation.session();
    session
        .submit_patch("a.asar", "main/index.js", "ABANDONED_PATCH")
        .unwrap();
    session.restore_backup(path.to_str().unwrap()).unwrap();
    session.apply_patches().unwrap();

    assert!(!installation
        .read("a.asar", "main/index.js")
        .contains("ABANDONED_PATCH"));
}

#[test]
fn failed_writes_discard_the_remaining_queue() {
    let installation = Installation::new();
    let mut session = installation.session();
    session
        .submit_patch("a.asar", "main/index.js", "FAILED_PATCH")
        .unwrap();
    session
        .submit_patch("b.asar", "main/index.js", "QUEUED_PATCH")
        .unwrap();
    let path = installation.root.join("a.asar");
    fs::remove_file(&path).unwrap();
    fs::create_dir(&path).unwrap();
    assert!(session.apply_patches().is_err());

    fs::remove_dir(&path).unwrap();
    installation.write_archive("a.asar", "original");
    session.apply_patches().unwrap();

    assert!(!installation
        .read("a.asar", "main/index.js")
        .contains("FAILED_PATCH"));
    assert!(!installation
        .read("b.asar", "main/index.js")
        .contains("QUEUED_PATCH"));
}
