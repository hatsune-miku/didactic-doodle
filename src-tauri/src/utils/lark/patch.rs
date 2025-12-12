use std::{
    hash::{Hash, Hasher},
    path::PathBuf,
};

use crate::{error::WalResult, info, utils::lark::file::LarkAsarFile};

pub struct PatchPayload {}

pub trait LarkAsarPatch {
    fn patch_script(&self, path: &PathBuf, script: &str) -> WalResult<PatchUnit>;
}

pub struct PatchUnit {
    pub path: PathBuf,
    pub data: Vec<u8>,
}

impl PartialEq for PatchUnit {
    fn eq(&self, other: &Self) -> bool {
        self.path == other.path
    }
}

impl Eq for PatchUnit {}

impl Hash for PatchUnit {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.path.hash(state);
    }
}

impl LarkAsarPatch for LarkAsarFile {
    fn patch_script(&self, path: &PathBuf, script: &str) -> WalResult<PatchUnit> {
        info!("patching script: {}", path.display());

        let mut content = self.read_string(path)?;
        let skip_pattern = "use strict";
        let patch_pattern_start = "\n/** WAL-ASSISTANT-LARK START */";
        let patch_pattern_end = "/** WAL-ASSISTANT-LARK END */\n";

        if content.contains(patch_pattern_start) && content.contains(patch_pattern_end) {
            info!("already patched. erasing old patch...");
            let erase_start_index = content.find(patch_pattern_start).unwrap();
            let erase_end_index =
                content.find(patch_pattern_end).unwrap() + patch_pattern_end.len();
            content.replace_range(erase_start_index..erase_end_index, "");
        }

        let start_index = if content.contains(skip_pattern) {
            info!("skipping pattern found. inserting patch after skip pattern...");
            let skip_pattern_index = content.find(skip_pattern).unwrap();
            skip_pattern_index + skip_pattern.len() + 1
        } else {
            0
        };

        content.insert_str(
            start_index,
            format!("{}\n{}\n{}", patch_pattern_start, script, patch_pattern_end).as_str(),
        );
        Ok(PatchUnit {
            path: path.clone(),
            data: content.as_bytes().to_vec(),
        })
    }
}
