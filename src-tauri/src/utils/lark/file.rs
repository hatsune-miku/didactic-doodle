use std::{
    cmp::Ordering,
    fs,
    path::{Component, Path, PathBuf},
};

use super::archive::Archive;
use crate::error::{WalError, WalResult};

#[derive(Clone, Debug)]
pub struct LarkAsarFile {
    archive: Archive,
    asar_absolute_path: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::lark::patch::LarkAsarPatch;

    fn file(entries: &[(&str, &str)]) -> LarkAsarFile {
        let mut writer = asar::AsarWriter::new();
        for (path, contents) in entries {
            writer
                .write_file(Path::new(path), contents.as_bytes(), false)
                .unwrap();
        }
        let mut bytes = Vec::new();
        writer.finalize(&mut bytes).unwrap();
        LarkAsarFile {
            archive: Archive::parse(bytes).unwrap(),
            asar_absolute_path: "test.asar".into(),
        }
    }

    #[test]
    fn resolves_referenced_runtime_when_the_subject_contains_multiple_chunks() {
        let file = file(&[
            ("messenger/one.js", "one"),
            ("messenger/two.js", "two"),
            (
                "messenger/zh-CN.html",
                "<script src=\"/runtime~messenger/hashed.js\"></script>",
            ),
            ("runtime~messenger/hashed.js", "runtime"),
        ]);
        assert_eq!(
            file.get_main_script_path("messenger").unwrap(),
            PathBuf::from("runtime~messenger/hashed.js")
        );
    }

    #[test]
    fn refuses_ambiguous_chunks_and_unreferenced_runtimes() {
        let file = file(&[
            ("messenger/one.js", "one"),
            ("messenger/two.js", "two"),
            ("runtime~messenger/hashed.js", "runtime"),
        ]);
        assert!(file.get_main_script_path("messenger").is_err());
    }

    #[test]
    fn injection_preserves_directives_and_literal_use_strict_strings() {
        let original =
            "\"use strict\"; const message = 'use strict inside text'; // trailing comment";
        let file = file(&[("main/index.js", original)]);
        let patch = file
            .patch_script(&PathBuf::from("main/index.js"), "window.injected = true")
            .unwrap();
        let content = String::from_utf8(patch.data).unwrap();
        assert!(content.starts_with(original));
        assert!(content.contains("\n;(() => {\nwindow.injected = true\n})();\n"));
    }
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
        let normalized = asar_path.replace('\\', "/");
        let relative = Path::new(&normalized);
        if relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
            || relative.extension().and_then(|ext| ext.to_str()) != Some("asar")
        {
            return Err(WalError::Message("主题中的 ASAR 路径无效".into()));
        }
        #[cfg(target_os = "windows")]
        let absolute = {
            let base = Path::new(&base_path).canonicalize()?;
            let path = base.join(relative).canonicalize()?;
            if !path.starts_with(&base) {
                return Err(WalError::IoError);
            }
            path
        };
        #[cfg(target_os = "macos")]
        let absolute = super::macos::installation::Installation::open(Path::new(&base_path))?
            .archive(&normalized)?;
        let asar_absolute_path = absolute
            .to_str()
            .ok_or(WalError::SystemEncodingError)?
            .to_owned();
        let archive = Archive::parse(fs::read(&absolute)?)?;

        Ok(Self {
            asar_absolute_path,
            archive,
        })
    }

    pub fn get_main_script_path(&self, subject: &str) -> WalResult<PathBuf> {
        let subject = subject.replace('\\', "/");
        let directory = Path::new(&subject);
        let scripts = self.archive.files_in(directory, ".js").unwrap_or_default();
        if scripts.len() == 1 {
            return Ok(scripts[0].clone());
        }
        // Recent messenger versions have many chunks. Only choose the unique
        // shared runtime when a real HTML entry point references it.
        let runtime = PathBuf::from(format!("runtime~{subject}"));
        let runtimes = self.archive.files_in(&runtime, ".js").unwrap_or_default();
        if runtimes.len() == 1 {
            let needle = runtimes[0].to_string_lossy().replace('\\', "/");
            for page in self
                .archive
                .files_in(directory, ".html")
                .unwrap_or_default()
            {
                if String::from_utf8_lossy(self.archive.read(&page)?).contains(&needle) {
                    return Ok(runtimes[0].clone());
                }
            }
        }
        Err(WalError::Message(format!(
            "无法确认 {subject} 的唯一脚本入口，请更新主题目标"
        )))
    }

    pub fn get_main_script_content(&self, subject: &str) -> WalResult<String> {
        let path = self.get_main_script_path(subject)?;
        self.read_string(&path)
    }

    pub fn read_string(&self, path: &PathBuf) -> WalResult<String> {
        let content = self.read(path)?;
        String::from_utf8(content).map_err(|_| WalError::SystemEncodingError)
    }

    pub fn read(&self, path: &PathBuf) -> WalResult<Vec<u8>> {
        self.archive.read(path).map(|bytes| bytes.to_vec())
    }

    pub fn patched<'a>(
        &self,
        patches: impl IntoIterator<Item = &'a super::patch::PatchUnit>,
    ) -> WalResult<Vec<u8>> {
        self.archive.patched(patches)
    }

    pub fn source_hash(&self) -> String {
        use sha2::{Digest, Sha256};
        format!("{:x}", Sha256::digest(self.archive.bytes()))
    }

    pub fn asar_absolute_path(&self) -> &str {
        &self.asar_absolute_path
    }
}
