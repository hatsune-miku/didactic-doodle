use std::path::{Component, Path};

use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use super::patch::PatchUnit;
use crate::error::{WalError, WalResult};

// Preserve the complete header (including links, unpacked files and unknown
// metadata) and the original payload. Only patched file offsets are redirected.
#[derive(Clone, Debug)]
pub struct Archive {
    bytes: Vec<u8>,
    header: Value,
    offset: usize,
}

impl Archive {
    pub fn parse(bytes: Vec<u8>) -> WalResult<Self> {
        if bytes.len() < 16 {
            return Err(WalError::AsarStructureError);
        }
        let word = |index| u32::from_le_bytes(bytes[index..index + 4].try_into().unwrap()) as usize;
        let size = word(4);
        let json_size = word(12);
        let offset = size.checked_add(8).ok_or(WalError::AsarStructureError)?;
        if word(0) != 4
            || size < 8
            || word(8) != size - 4
            || json_size > size - 8
            || offset > bytes.len()
            || json_size > 64 * 1024 * 1024
        {
            return Err(WalError::AsarStructureError);
        }
        let header: Value = serde_json::from_slice(&bytes[16..16 + json_size])
            .map_err(|_| WalError::AsarStructureError)?;
        if !header.get("files").is_some_and(Value::is_object) {
            return Err(WalError::AsarStructureError);
        }
        Ok(Self {
            bytes,
            header,
            offset,
        })
    }

    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    pub fn read(&self, path: &Path) -> WalResult<&[u8]> {
        let node = entry(&self.header, path)?;
        if node.get("unpacked") == Some(&Value::Bool(true)) || node.get("link").is_some() {
            return Err(WalError::Message(
                "不支持修改 ASAR 外置文件或符号链接".into(),
            ));
        }
        let start = node
            .get("offset")
            .and_then(Value::as_str)
            .and_then(|value| value.parse::<usize>().ok())
            .and_then(|value| self.offset.checked_add(value))
            .ok_or(WalError::AsarStructureError)?;
        let size = node
            .get("size")
            .and_then(Value::as_u64)
            .and_then(|value| usize::try_from(value).ok())
            .ok_or(WalError::AsarStructureError)?;
        let end = start
            .checked_add(size)
            .ok_or(WalError::AsarStructureError)?;
        self.bytes
            .get(start..end)
            .ok_or(WalError::AsarStructureError)
    }

    pub fn files_in(&self, path: &Path, extension: &str) -> WalResult<Vec<std::path::PathBuf>> {
        let directory = entry(&self.header, path)?;
        let files = directory
            .get("files")
            .and_then(Value::as_object)
            .ok_or(WalError::AsarStructureError)?;
        Ok(files
            .iter()
            .filter(|(name, value)| name.ends_with(extension) && value.get("offset").is_some())
            .map(|(name, _)| path.join(name))
            .collect())
    }

    pub fn patched<'a>(
        &self,
        patches: impl IntoIterator<Item = &'a PatchUnit>,
    ) -> WalResult<Vec<u8>> {
        let mut header = self.header.clone();
        let mut additions = Vec::new();
        let mut next_offset = self.bytes.len() - self.offset;
        for patch in patches {
            self.read(&patch.path)?;
            let node = entry_mut(&mut header, &patch.path)?;
            node["offset"] = Value::String(next_offset.to_string());
            node["size"] = json!(patch.data.len());
            if let Some(integrity) = node.get_mut("integrity") {
                if integrity["algorithm"].as_str() != Some("SHA256") {
                    return Err(WalError::Message("不支持的 ASAR 完整性算法".into()));
                }
                let block_size = integrity["blockSize"]
                    .as_u64()
                    .and_then(|size| usize::try_from(size).ok())
                    .filter(|size| *size > 0)
                    .ok_or(WalError::AsarStructureError)?;
                integrity["hash"] = json!(format!("{:x}", Sha256::digest(&patch.data)));
                integrity["blocks"] = json!(patch
                    .data
                    .chunks(block_size)
                    .map(|chunk| format!("{:x}", Sha256::digest(chunk)))
                    .collect::<Vec<_>>());
            }
            next_offset = next_offset
                .checked_add(patch.data.len())
                .ok_or(WalError::AsarStructureError)?;
            additions.extend_from_slice(&patch.data);
        }
        let mut output = encode_header(&header)?;
        output.extend_from_slice(&self.bytes[self.offset..]);
        output.extend_from_slice(&additions);
        Ok(output)
    }
}

fn parts(path: &Path) -> WalResult<Vec<&str>> {
    if path.as_os_str().is_empty() {
        return Err(WalError::AsarStructureError);
    }
    path.components()
        .map(|component| match component {
            Component::Normal(value) => value.to_str().ok_or(WalError::SystemEncodingError),
            _ => Err(WalError::AsarStructureError),
        })
        .collect()
}

fn entry<'a>(header: &'a Value, path: &Path) -> WalResult<&'a Value> {
    let mut node = header;
    for part in parts(path)? {
        node = node
            .get("files")
            .and_then(|files| files.get(part))
            .ok_or_else(|| WalError::Message(format!("ASAR 中未找到: {}", path.display())))?;
    }
    Ok(node)
}

fn entry_mut<'a>(header: &'a mut Value, path: &Path) -> WalResult<&'a mut Value> {
    let mut node = header;
    for part in parts(path)? {
        node = node
            .get_mut("files")
            .and_then(|files| files.get_mut(part))
            .ok_or(WalError::AsarStructureError)?;
    }
    Ok(node)
}

fn encode_header(header: &Value) -> WalResult<Vec<u8>> {
    let data = serde_json::to_vec(header).map_err(|_| WalError::AsarStructureError)?;
    let len = u32::try_from(data.len()).map_err(|_| WalError::AsarStructureError)?;
    let padding = (4 - len % 4) % 4;
    let payload = len
        .checked_add(padding + 4)
        .ok_or(WalError::AsarStructureError)?;
    let mut bytes = Vec::new();
    for word in [4u32, payload + 4, payload, len] {
        bytes.extend_from_slice(&word.to_le_bytes());
    }
    bytes.extend_from_slice(&data);
    bytes.resize(bytes.len() + padding as usize, 0);
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn patch_preserves_metadata_and_other_payloads_and_recalculates_integrity() {
        let header = json!({"custom": "preserved", "files": {
            "main.js": {"size": 3, "offset": "0", "executable": true, "custom": 42,
                "integrity": {"algorithm": "SHA256", "blockSize": 2, "hash": "old", "blocks": ["old"]}},
            "other.js": {"size": 4, "offset": "3"},
            "linked": {"link": "other.js"},
            "external.node": {"size": 99, "unpacked": true}
        }});
        let mut bytes = encode_header(&header).unwrap();
        bytes.extend_from_slice(b"oldkeep");
        let archive = Archive::parse(bytes).unwrap();
        let patch = PatchUnit {
            path: "main.js".into(),
            data: b"new content".to_vec(),
        };
        let patched = Archive::parse(archive.patched([&patch]).unwrap()).unwrap();
        assert_eq!(patched.read(Path::new("main.js")).unwrap(), b"new content");
        assert_eq!(patched.read(Path::new("other.js")).unwrap(), b"keep");
        assert_eq!(patched.header["custom"], "preserved");
        for name in ["other.js", "linked", "external.node"] {
            assert_eq!(patched.header["files"][name], header["files"][name]);
        }
        assert_eq!(patched.header["files"]["main.js"]["executable"], true);
        assert_eq!(patched.header["files"]["main.js"]["custom"], 42);
        assert_eq!(
            patched.header["files"]["main.js"]["integrity"]["hash"],
            format!("{:x}", Sha256::digest(b"new content"))
        );
        assert_eq!(
            patched.header["files"]["main.js"]["integrity"]["blocks"]
                .as_array()
                .unwrap()
                .len(),
            6
        );
        assert_eq!(
            &patched.bytes[patched.offset..patched.offset + 7],
            b"oldkeep"
        );
        assert!(archive
            .patched([&PatchUnit {
                path: "external.node".into(),
                data: vec![1]
            }])
            .is_err());
    }

    #[test]
    fn rejects_truncated_archives_and_out_of_bounds_entries() {
        assert!(Archive::parse(vec![0; 15]).is_err());
        let bytes =
            encode_header(&json!({"files":{"main.js":{"size":9,"offset":"18446744073709551615"}}}))
                .unwrap();
        let archive = Archive::parse(bytes).unwrap();
        assert!(archive.read(Path::new("main.js")).is_err());
        assert!(archive.read(Path::new("../main.js")).is_err());
    }
}
