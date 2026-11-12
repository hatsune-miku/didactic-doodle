use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Command,
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::{
    access,
    installation::{sha256, Installation},
};
use crate::{
    error::{WalError, WalResult},
    info,
    utils::platform::process,
};

#[derive(Deserialize, Serialize)]
struct Record {
    relative_path: String,
    original_sha256: String,
    // Written before replacing the archive, so an interrupted commit is recoverable.
    installed_sha256: Vec<String>,
}

pub struct Store {
    pub installation: Installation,
    directory: PathBuf,
}

struct Replacement {
    target: PathBuf,
    source: PathBuf,
    expected: String,
    desired: String,
}

fn staging_directory(target: &Path) -> WalResult<PathBuf> {
    let parent = target.parent().ok_or(WalError::IoError)?;
    Ok(parent.join(format!(
        ".wal-stage-{}",
        sha256(target.as_os_str().as_encoded_bytes())
    )))
}

pub fn file_hash(path: &Path) -> WalResult<String> {
    let mut file = fs::File::open(path)?;
    let mut digest = Sha256::new();
    let mut buffer = [0; 64 * 1024];
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

pub fn default_backup_root() -> WalResult<PathBuf> {
    let home =
        std::env::var_os("HOME").ok_or_else(|| WalError::Message("无法定位用户目录".into()))?;
    Ok(PathBuf::from(home).join("Library/Application Support/com.miku.wal/asar-backups"))
}

impl Store {
    pub fn new(installation: Installation, root: &Path) -> Self {
        let key = sha256(installation.app.as_os_str().as_encoded_bytes());
        let directory = root.join(key).join(&installation.fingerprint);
        Self {
            installation,
            directory,
        }
    }

    fn lock(&self) -> WalResult<fs::File> {
        let directory = self.directory.parent().ok_or(WalError::IoError)?;
        fs::create_dir_all(directory)?;
        let file = fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(directory.join("operation.lock"))?;
        file.try_lock()
            .map_err(|_| WalError::Message("另一个 WAL 正在修改飞书，请稍后重试".into()))?;
        Ok(file)
    }

    fn paths(&self, target: &Path) -> WalResult<(PathBuf, PathBuf)> {
        self.installation.validate_archive(target)?;
        let relative = target.strip_prefix(&self.installation.resources).unwrap();
        let key = sha256(relative.as_os_str().as_encoded_bytes());
        Ok((
            self.directory.join(format!("{key}.json")),
            self.directory.join(format!("{key}.asar")),
        ))
    }

    fn read_record(&self, path: &Path) -> WalResult<Record> {
        serde_json::from_slice(&fs::read(path)?)
            .map_err(|error| WalError::Message(format!("备份记录损坏: {error}")))
    }

    fn save_record(&self, path: &Path, record: &Record) -> WalResult<()> {
        let data = serde_json::to_vec(record).map_err(|_| WalError::IoError)?;
        let mut temporary = tempfile::NamedTempFile::new_in(&self.directory)?;
        temporary.write_all(&data)?;
        temporary.as_file().sync_all()?;
        temporary
            .persist(path)
            .map_err(|error| WalError::from(error.error))?;
        fs::File::open(&self.directory)?.sync_all()?;
        Ok(())
    }

    fn validate_record(
        &self,
        target: &Path,
        record: &Record,
        original: &Path,
    ) -> WalResult<String> {
        let relative = target.strip_prefix(&self.installation.resources).unwrap();
        if relative.to_str() != Some(&record.relative_path)
            || file_hash(original)? != record.original_sha256
        {
            return Err(WalError::Message("原版备份校验失败，已停止写入".into()));
        }
        let current = file_hash(target)?;
        if current != record.original_sha256 && !record.installed_sha256.contains(&current) {
            return Err(WalError::Message(
                "飞书资源已被更新或由其他程序修改，不能覆盖旧备份".into(),
            ));
        }
        Ok(current)
    }

    pub fn backup_exists(&self, target: &Path) -> WalResult<bool> {
        let (record, _) = self.paths(target)?;
        Ok(record.try_exists()?)
    }

    pub fn create_backup(&self, target: &Path) -> WalResult<()> {
        let _lock = self.lock()?;
        self.ensure_backup(target)
    }

    fn ensure_backup(&self, target: &Path) -> WalResult<()> {
        self.installation.check_unchanged()?;
        let (record_path, original) = self.paths(target)?;
        if record_path.exists() {
            self.validate_record(target, &self.read_record(&record_path)?, &original)?;
            return Ok(());
        }
        fs::create_dir_all(&self.directory)?;
        let hash = file_hash(target)?;
        let mut temporary = tempfile::NamedTempFile::new_in(&self.directory)?;
        std::io::copy(&mut fs::File::open(target)?, &mut temporary)?;
        temporary.as_file().sync_all()?;
        if file_hash(temporary.path())? != hash || file_hash(target)? != hash {
            return Err(WalError::Message("备份过程中飞书资源发生变化".into()));
        }
        temporary
            .persist(&original)
            .map_err(|error| WalError::from(error.error))?;
        let record = Record {
            relative_path: target
                .strip_prefix(&self.installation.resources)
                .unwrap()
                .to_str()
                .ok_or(WalError::SystemEncodingError)?
                .to_owned(),
            original_sha256: hash,
            installed_sha256: Vec::new(),
        };
        self.save_record(&record_path, &record)
    }

    pub fn targets(&self) -> WalResult<Vec<PathBuf>> {
        if !self.directory.try_exists()? {
            return Ok(Vec::new());
        }
        let mut targets = Vec::new();
        for entry in fs::read_dir(&self.directory)? {
            let path = entry?.path();
            if path.extension().and_then(|value| value.to_str()) != Some("json") {
                continue;
            }
            let record = self.read_record(&path)?;
            let target = self.installation.archive(&record.relative_path)?;
            if self.paths(&target)?.0 != path {
                return Err(WalError::Message("备份记录路径不匹配".into()));
            }
            targets.push(target);
        }
        targets.sort();
        Ok(targets)
    }

    pub fn apply(&self, files: &[(PathBuf, Vec<u8>, String)]) -> WalResult<()> {
        let _lock = self.lock()?;
        let stage = tempfile::tempdir()?;
        let mut replacements = Vec::new();
        for (index, (target, data, expected)) in files.iter().enumerate() {
            if file_hash(target)? != *expected {
                return Err(WalError::Message(
                    "准备补丁后飞书资源发生变化，请重试".into(),
                ));
            }
            self.ensure_backup(target)?;
            let (record_path, original) = self.paths(target)?;
            let mut record = self.read_record(&record_path)?;
            let current = self.validate_record(target, &record, &original)?;
            if current != *expected {
                return Err(WalError::Message(
                    "准备备份后飞书资源发生变化，请重试".into(),
                ));
            }
            let desired = sha256(data);
            if !record.installed_sha256.contains(&desired) {
                record.installed_sha256.push(desired.clone());
                self.save_record(&record_path, &record)?;
            }
            let source = stage.path().join(format!("{index}.asar"));
            let mut file = fs::File::create(&source)?;
            file.write_all(data)?;
            file.sync_all()?;
            replacements.push(Replacement {
                target: target.clone(),
                source,
                expected: current,
                desired,
            });
        }
        self.commit(&replacements)
    }

    pub fn restore(&self, targets: &[PathBuf]) -> WalResult<()> {
        let _lock = self.lock()?;
        let mut replacements = Vec::new();
        for target in targets {
            let (record_path, original) = self.paths(target)?;
            let record = self.read_record(&record_path)?;
            let current = self.validate_record(target, &record, &original)?;
            let staged = match fs::symlink_metadata(staging_directory(target)?) {
                Ok(_) => true,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
                Err(error) => return Err(error.into()),
            };
            if current != record.original_sha256 || staged {
                replacements.push(Replacement {
                    target: target.clone(),
                    source: original,
                    expected: current,
                    desired: record.original_sha256,
                });
            }
        }
        self.commit(&replacements)
    }

    fn commit(&self, replacements: &[Replacement]) -> WalResult<()> {
        self.installation.check_unchanged()?;
        process::require_stopped(&self.installation.app)?;
        if replacements.is_empty() {
            return Ok(());
        }
        let script = replacement_script(&self.installation, replacements)?;
        // Check directory access without touching the original archive. A protected
        // installation uses the system authorization dialog for this write only.
        use std::os::unix::fs::MetadataExt;
        let mut writable = true;
        for item in replacements {
            let directory = item.target.parent().unwrap();
            // Probe every destination even if another one needs elevation: any
            // App Management denial must be handled before requesting root.
            let access = access::probe_directory(directory)?;
            writable &= matches!(access, access::WriteAccess::Writable(uid)
                if uid == fs::metadata(&item.target)?.uid());
        }
        let output = if writable {
            Command::new("/bin/sh").args(["-c", &script]).output()?
        } else {
            info!("需要管理员权限以修改飞书资源");
            Command::new("/usr/bin/osascript")
                .args([
                    "-e",
                    "on run argv",
                    "-e",
                    "do shell script (item 1 of argv) with administrator privileges",
                    "-e",
                    "end run",
                    "--",
                    &script,
                ])
                .output()?
        };
        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(access::write_error(&error));
        }
        for item in replacements {
            if file_hash(&item.target)? != item.desired {
                return Err(WalError::Message("写入校验失败，请恢复官方原版".into()));
            }
        }
        Ok(())
    }
}

fn quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn quoted_path(path: &Path) -> WalResult<String> {
    Ok(quote(path.to_str().ok_or(WalError::SystemEncodingError)?))
}

fn replacement_script(
    installation: &Installation,
    replacements: &[Replacement],
) -> WalResult<String> {
    let current_resources = installation
        .app
        .join("Contents/Frameworks/Lark Framework.framework/Versions/Current/Resources");
    let prefix = quote(&format!("{}/Contents/", installation.app.display()));
    let stamps = installation
        .stamps
        .iter()
        .map(|(path, digest)| {
            Ok(format!(
                "  check_hash {} {}",
                quoted_path(path)?,
                quote(digest)
            ))
        })
        .collect::<WalResult<Vec<_>>>()?
        .join("\n");
    let mut script = format!(
        r#"set -eu
export LC_ALL=en_US.UTF-8
check_hash() {{
  [ -f "$1" ] && [ ! -L "$1" ] || {{ echo '资源文件已变化' >&2; exit 1; }}
  wal_hash=$(/usr/bin/shasum -a 256 "$1")
  [ "${{wal_hash%% *}}" = "$2" ] || {{ echo '资源校验失败，已停止写入' >&2; exit 1; }}
}}
check_app() {{
{stamps}
  [ "$(cd {current_resources} && /bin/pwd -P)" = {resources} ] || exit 1
  wal_processes=$(/bin/ps -axo comm=)
  if /usr/bin/printf '%s\n' "$wal_processes" | /usr/bin/grep -F -q -- {prefix}; then
    echo '飞书正在运行，请先关闭' >&2; exit 1
  fi
}}
check_app
"#,
        current_resources = quoted_path(&current_resources)?,
        resources = quoted_path(&installation.resources)?
    );
    // Temporary directories are on the target volume; rename is atomic. Keep a
    // copy of each pre-write file until all renames succeed so failures roll back.
    script.push_str("wal_success=0\ncleanup() {\n  wal_status=$?\n  trap - EXIT\n");
    for (index, item) in replacements.iter().enumerate() {
        let target = quoted_path(&item.target)?;
        script.push_str(&format!("  if [ -n \"${{wal_stage_{index}:-}}\" ]; then\n    if [ \"$wal_success\" = 0 ] && [ \"${{wal_done_{index}:-0}}\" = 1 ]; then\n      /bin/mv -f \"$wal_stage_{index}/before\" {target} || wal_status=1\n    fi\n    /bin/rm -rf \"$wal_stage_{index}\"\n  fi\n"));
    }
    script.push_str("  exit \"$wal_status\"\n}\ntrap cleanup EXIT\ntrap 'exit 1' HUP INT TERM\n");
    for (index, item) in replacements.iter().enumerate() {
        let target = quoted_path(&item.target)?;
        let source = quoted_path(&item.source)?;
        let stage = quoted_path(&staging_directory(&item.target)?)?;
        let owner = quote(&sha256(item.target.as_os_str().as_encoded_bytes()));
        use std::os::unix::fs::PermissionsExt;
        let mode = fs::metadata(&item.target)?.permissions().mode() & 0o7777;
        script.push_str(&format!(r#"check_hash {target} {expected}
check_hash {source} {desired}
wal_next={stage}
if [ -e "$wal_next" ] || [ -L "$wal_next" ]; then
  [ -d "$wal_next" ] && [ ! -L "$wal_next" ] || {{ echo '暂存路径异常' >&2; exit 1; }}
  if [ -f "$wal_next/owner" ] && [ ! -L "$wal_next/owner" ] && [ "$(/bin/cat "$wal_next/owner")" = {owner} ]; then
    /bin/rm -rf "$wal_next"
  else
    /bin/rmdir "$wal_next" || {{ echo '暂存目录无法确认，已停止写入' >&2; exit 1; }}
  fi
fi
/bin/mkdir -m 700 "$wal_next"
wal_stage_{index}=$wal_next
/usr/bin/printf '%s' {owner} > "$wal_stage_{index}/owner"
/bin/cp -p {target} "$wal_stage_{index}/before"
/bin/cp -p {target} "$wal_stage_{index}/after"
/bin/chmod u+w "$wal_stage_{index}/after"
/bin/cat {source} > "$wal_stage_{index}/after"
/bin/chmod {mode:o} "$wal_stage_{index}/after"
check_hash "$wal_stage_{index}/after" {desired}
"#, expected=quote(&item.expected), desired=quote(&item.desired)));
    }
    for (index, item) in replacements.iter().enumerate() {
        script.push_str(&format!("check_app\ncheck_hash {target} {expected}\nwal_done_{index}=1\n/bin/mv -f \"$wal_stage_{index}/after\" {target}\n", target=quoted_path(&item.target)?, expected=quote(&item.expected)));
    }
    script.push_str("wal_success=1\n");
    Ok(script)
}

#[cfg(test)]
mod tests;
