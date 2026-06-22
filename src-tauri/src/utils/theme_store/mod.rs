use std::path::{Path, PathBuf};

use crate::error::{WalError, WalResult};

/// 主题文件存放目录：<app_data>/themes
pub fn themes_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("themes")
}

/// 清单文件：<app_data>/themes.json
pub fn manifest_file(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("themes.json")
}

fn ensure_dir(dir: &Path) -> WalResult<()> {
    std::fs::create_dir_all(dir).map_err(|_| WalError::IoError)
}

/// 过滤掉文件名中的危险字符（路径分隔符、Windows 保留字符、控制字符）
fn sanitize_stem(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| !matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
        .filter(|c| !c.is_control())
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').trim();
    if trimmed.is_empty() {
        "theme".to_string()
    } else {
        trimmed.to_string()
    }
}

/// 拒绝带路径分隔符 / 跨目录的文件名，防止越权访问
fn safe_join(dir: &Path, file_name: &str) -> WalResult<PathBuf> {
    if file_name.is_empty()
        || file_name.contains('/')
        || file_name.contains('\\')
        || file_name.contains("..")
    {
        return Err(WalError::IoError);
    }
    Ok(dir.join(file_name))
}

pub struct PickedTheme {
    /// 当 YAML 未提供 id 时回退使用的标识（源文件名去扩展名）。
    pub suggested_id: String,
    pub content: String,
}

/// 读取一个外部文件的内容，并给出回退 id（不写入托管目录）。
pub fn read_source(src: &Path) -> WalResult<PickedTheme> {
    let content = std::fs::read_to_string(src).map_err(|_| WalError::IoError)?;
    let stem = src.file_stem().and_then(|s| s.to_str()).unwrap_or("theme");
    Ok(PickedTheme {
        suggested_id: sanitize_stem(stem),
        content,
    })
}

/// 按 id 派生文件名（`<sanitized-id>.yaml`）写入托管目录，已存在则覆盖；返回实际文件名。
pub fn save_theme(app_data_dir: &Path, id: &str, content: &str) -> WalResult<String> {
    let dir = themes_dir(app_data_dir);
    ensure_dir(&dir)?;
    let file_name = format!("{}.yaml", sanitize_stem(id));
    let path = safe_join(&dir, &file_name)?;
    std::fs::write(&path, content).map_err(|_| WalError::IoError)?;
    Ok(file_name)
}

/// 从托管目录新鲜读取一个主题文件（始终读盘，不经任何缓存）
pub fn read_theme(app_data_dir: &Path, file_name: &str) -> WalResult<String> {
    let dir = themes_dir(app_data_dir);
    let path = safe_join(&dir, file_name)?;
    std::fs::read_to_string(&path).map_err(|_| WalError::IoError)
}

pub fn delete_theme(app_data_dir: &Path, file_name: &str) -> WalResult<()> {
    let dir = themes_dir(app_data_dir);
    let path = safe_join(&dir, file_name)?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|_| WalError::IoError)?;
    }
    Ok(())
}

/// 读取清单；不存在时返回空清单
pub fn read_manifest(app_data_dir: &Path) -> WalResult<String> {
    let path = manifest_file(app_data_dir);
    if !path.exists() {
        return Ok("{\"themes\":[]}".to_string());
    }
    std::fs::read_to_string(&path).map_err(|_| WalError::IoError)
}

pub fn write_manifest(app_data_dir: &Path, content: &str) -> WalResult<()> {
    ensure_dir(app_data_dir)?;
    let path = manifest_file(app_data_dir);
    std::fs::write(&path, content).map_err(|_| WalError::IoError)
}
