use super::*;
use crate::utils::lark::macos::test_support::Fixture;
use std::os::unix::fs::{MetadataExt, PermissionsExt};

#[test]
fn concurrent_instances_cannot_overwrite_backup_records() {
    let fixture = Fixture::new();
    let path = fixture.archive("webcontent/a.asar", b"original");
    let store = Store::new(fixture.installation.clone(), &fixture.backups);
    let _lock = store.lock().unwrap();
    assert!(store
        .apply(&[(path.clone(), b"patched".to_vec(), sha256(b"original"))])
        .is_err());
    assert_eq!(fs::read(path).unwrap(), b"original");
}

#[test]
fn recovery_removes_owned_staging_even_when_original_archive_is_unchanged() {
    let fixture = Fixture::new();
    let target = fixture.archive("webcontent/a.asar", b"original");
    let store = Store::new(fixture.installation.clone(), &fixture.backups);
    store.create_backup(&target).unwrap();
    // Simulate a killed process during staging, before any archive was replaced.
    let stage = staging_directory(&target).unwrap();
    fs::create_dir(&stage).unwrap();
    fs::write(
        stage.join("owner"),
        sha256(target.as_os_str().as_encoded_bytes()),
    )
    .unwrap();
    fs::write(stage.join("after"), b"incomplete").unwrap();
    store.restore(&[target.clone()]).unwrap();
    assert!(!stage.exists());
    assert_eq!(fs::read(target).unwrap(), b"original");
}

#[test]
fn staging_collision_does_not_delete_unrecognized_files() {
    let fixture = Fixture::new();
    let target = fixture.archive("webcontent/a.asar", b"original");
    let store = Store::new(fixture.installation.clone(), &fixture.backups);
    let stage = staging_directory(&target).unwrap();
    fs::create_dir(&stage).unwrap();
    fs::write(stage.join("unrelated"), b"keep").unwrap();
    assert!(store
        .apply(&[(target.clone(), b"patched".to_vec(), sha256(b"original"))])
        .is_err());
    assert_eq!(fs::read(stage.join("unrelated")).unwrap(), b"keep");
    assert_eq!(fs::read(target).unwrap(), b"original");
}

#[test]
fn running_bundle_is_detected_by_native_and_post_authorization_guards() {
    let fixture = Fixture::new();
    let target = fixture.archive("webcontent/a.asar", b"original");
    let source = fixture.directory.path().join("patched");
    fs::write(&source, b"patched").unwrap();
    let script = replacement_script(
        &fixture.installation,
        &[Replacement {
            target: target.clone(),
            source,
            expected: sha256(b"original"),
            desired: sha256(b"patched"),
        }],
    )
    .unwrap();
    let executable = fixture.installation.app.join("Contents/MacOS/Lark");
    fs::create_dir_all(executable.parent().unwrap()).unwrap();
    fs::copy("/bin/sleep", &executable).unwrap();
    let mut child = Command::new(&executable).arg("30").spawn().unwrap();
    let store = Store::new(fixture.installation.clone(), &fixture.backups);
    let native_running = process::is_running(&fixture.installation.app).unwrap();
    let result = store.apply(&[(target.clone(), b"patched".to_vec(), sha256(b"original"))]);
    let output = Command::new("/bin/sh")
        .args(["-c", &script])
        .output()
        .unwrap();
    let stopped = process::kill(&fixture.installation.app);
    let _ = child.kill();
    let _ = child.wait();
    assert!(native_running);
    assert!(result.is_err());
    assert!(!output.status.success());
    assert!(stopped.is_ok());
    assert!(!process::is_running(&fixture.installation.app).unwrap());
    assert_eq!(fs::read(target).unwrap(), b"original");
}

#[test]
fn version_change_while_waiting_for_authorization_stops_the_script() {
    let fixture = Fixture::new();
    let target = fixture.archive("webcontent/a.asar", b"original");
    let source = fixture.directory.path().join("patched");
    fs::write(&source, b"patched").unwrap();
    let script = replacement_script(
        &fixture.installation,
        &[Replacement {
            target: target.clone(),
            source,
            expected: sha256(b"original"),
            desired: sha256(b"patched"),
        }],
    )
    .unwrap();
    fixture.update_version();
    let output = Command::new("/bin/sh")
        .args(["-c", &script])
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert_eq!(fs::read(target).unwrap(), b"original");
}

#[test]
#[ignore = "reads the locally installed Feishu archive; writes only to a temporary fixture"]
fn installed_messenger_archive_round_trip() {
    use crate::utils::lark::{
        file::LarkAsarFile, macos::installation::locate, patch::LarkAsarPatch,
    };
    let actual = Installation::open(&locate().unwrap()).unwrap();
    let source = actual.archive("webcontent/messenger.asar").unwrap();
    let original = fs::read(&source).unwrap();
    let original_hash = sha256(&original);
    let fixture = Fixture::new();
    let target = fixture.archive("webcontent/messenger.asar", &original);
    let file = LarkAsarFile::new(
        fixture.installation.app.to_str().unwrap().to_owned(),
        "webcontent/messenger.asar".into(),
    )
    .unwrap();
    let inner = file.get_main_script_path("messenger").unwrap();
    let patch = file
        .patch_script(&inner, "window.__walMacTest = true;")
        .unwrap();
    let patched = file.patched([&patch]).unwrap();
    // Independent parser checks all entries, not just the selected script.
    let before = asar::AsarReader::new(&original, None).unwrap();
    let after = asar::AsarReader::new(&patched, None).unwrap();
    assert_eq!(before.files().len(), after.files().len());
    let mut changed = Vec::new();
    for (path, entry) in before.files() {
        if entry.data() != after.read(path).unwrap().data() {
            changed.push(path.clone());
        }
    }
    assert_eq!(changed, [inner.clone()]);
    let store = Store::new(fixture.installation.clone(), &fixture.backups);
    let started = std::time::Instant::now();
    store
        .apply(&[(target.clone(), patched, original_hash.clone())])
        .unwrap();
    let apply_elapsed = started.elapsed();
    let started = std::time::Instant::now();
    store.restore(&[target.clone()]).unwrap();
    let restore_elapsed = started.elapsed();
    assert_eq!(file_hash(&target).unwrap(), original_hash);
    assert_eq!(file_hash(&source).unwrap(), original_hash);
    println!(
        "{} files; target {}; apply {:?}; restore {:?}; installed archive unchanged",
        before.files().len(),
        inner.display(),
        apply_elapsed,
        restore_elapsed
    );
}

#[test]
fn applies_and_restores_only_archives_with_exact_bytes_and_permissions() {
    let fixture = Fixture::new();
    let path = fixture.archive("webcontent/a.asar", b"original");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o444)).unwrap();
    let owner = fs::metadata(&path).unwrap().uid();
    let store = Store::new(fixture.installation.clone(), &fixture.backups);
    store
        .apply(&[(path.clone(), b"patched".to_vec(), sha256(b"original"))])
        .unwrap();
    assert_eq!(fs::read(&path).unwrap(), b"patched");
    assert_eq!(
        fs::metadata(&path).unwrap().permissions().mode() & 0o777,
        0o444
    );
    assert_eq!(fs::metadata(&path).unwrap().uid(), owner);
    assert_eq!(store.targets().unwrap(), [path.clone()]);
    assert!(!path.with_extension("asar.wal-backup").exists());
    store.restore(&store.targets().unwrap()).unwrap();
    assert_eq!(fs::read(&path).unwrap(), b"original");
    // A restored backup is reusable and does not require another full copy.
    store.restore(&store.targets().unwrap()).unwrap();
    store
        .apply(&[(path.clone(), b"second".to_vec(), sha256(b"original"))])
        .unwrap();
    store.restore(&[path.clone()]).unwrap();
    assert_eq!(fs::read(path).unwrap(), b"original");
}

#[test]
fn rejects_corrupt_backups_and_unrecognized_resource_changes() {
    let fixture = Fixture::new();
    let path = fixture.archive("webcontent/a.asar", b"original");
    let store = Store::new(fixture.installation.clone(), &fixture.backups);
    store
        .apply(&[(path.clone(), b"patched".to_vec(), sha256(b"original"))])
        .unwrap();
    fs::write(&path, b"external update").unwrap();
    assert!(store.restore(&[path.clone()]).is_err());
    assert_eq!(fs::read(&path).unwrap(), b"external update");
    fs::write(&path, b"patched").unwrap();
    let (_, original) = store.paths(&path).unwrap();
    fs::write(original, b"corrupted").unwrap();
    assert!(store.restore(&[path.clone()]).is_err());
    assert_eq!(fs::read(path).unwrap(), b"patched");
}

#[test]
fn version_changes_isolate_backups_and_reject_the_old_session() {
    let fixture = Fixture::new();
    let path = fixture.archive("webcontent/a.asar", b"original");
    let store = Store::new(fixture.installation.clone(), &fixture.backups);
    store
        .apply(&[(path.clone(), b"patched".to_vec(), sha256(b"original"))])
        .unwrap();
    fixture.update_version();
    fs::write(&path, b"new version").unwrap();
    assert!(store.restore(&[path.clone()]).is_err());
    let updated = Store::new(
        Installation::open(&fixture.installation.app).unwrap(),
        &fixture.backups,
    );
    assert!(updated.targets().unwrap().is_empty());
    assert_eq!(fs::read(path).unwrap(), b"new version");
}

#[test]
fn preserves_recovery_record_when_commit_is_interrupted() {
    let fixture = Fixture::new();
    let path = fixture.archive("webcontent/a.asar", b"original");
    let store = Store::new(fixture.installation.clone(), &fixture.backups);
    store.create_backup(&path).unwrap();
    let (record_path, _) = store.paths(&path).unwrap();
    let mut record = store.read_record(&record_path).unwrap();
    record.installed_sha256.push(sha256(b"patched"));
    store.save_record(&record_path, &record).unwrap();
    // Simulate termination after rename but before returning success to the UI.
    fs::write(&path, b"patched").unwrap();
    let reopened = Store::new(fixture.installation.clone(), &fixture.backups);
    reopened.restore(&reopened.targets().unwrap()).unwrap();
    assert_eq!(fs::read(path).unwrap(), b"original");
}

#[test]
fn script_rolls_back_an_earlier_rename_if_a_later_commit_fails() {
    let fixture = Fixture::new();
    let first = fixture.archive("webcontent/a.asar", b"first original");
    let second = fixture.archive("webcontent/b.asar", b"second original");
    let first_source = fixture.directory.path().join("first");
    let second_source = fixture.directory.path().join("second");
    fs::write(&first_source, b"first patched").unwrap();
    fs::write(&second_source, b"second patched").unwrap();
    let replacements = vec![
        Replacement {
            target: first.clone(),
            source: first_source,
            expected: sha256(b"first original"),
            desired: sha256(b"first patched"),
        },
        Replacement {
            target: second.clone(),
            source: second_source,
            expected: sha256(b"second original"),
            desired: sha256(b"second patched"),
        },
    ];
    let script = replacement_script(&fixture.installation, &replacements).unwrap();
    // Remove only the second staged output to force the second rename to fail.
    let script = script.replace(
        "wal_done_1=1",
        "/bin/rm \"$wal_stage_1/after\"\nwal_done_1=1",
    );
    let output = Command::new("/bin/sh")
        .args(["-c", &script])
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert_eq!(fs::read(first).unwrap(), b"first original");
    assert_eq!(fs::read(second).unwrap(), b"second original");
}

#[test]
fn rejects_paths_escaping_the_resource_directory() {
    let fixture = Fixture::new();
    fixture.archive("webcontent/a.asar", b"original");
    for path in [
        "../a.asar",
        "/tmp/a.asar",
        "webcontent/../../a.asar",
        "webcontent/a.js",
    ] {
        assert!(fixture.installation.archive(path).is_err());
    }
    let external = fixture.directory.path().join("outside.asar");
    fs::write(&external, b"outside").unwrap();
    std::os::unix::fs::symlink(
        external,
        fixture
            .installation
            .resources
            .join("webcontent/linked.asar"),
    )
    .unwrap();
    assert!(fixture
        .installation
        .archive("webcontent/linked.asar")
        .is_err());
    assert!(fixture.installation.archive("webcontent\\a.asar").is_ok());
}
