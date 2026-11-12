use std::{
    env, fs,
    path::{Component, Path, PathBuf},
    process::Command,
};

use sha2::{Digest, Sha256};

use crate::error::{WalError, WalResult};

#[derive(Clone, Debug)]
pub struct Installation {
    pub app: PathBuf,
    pub resources: PathBuf,
    pub fingerprint: String,
    pub stamps: Vec<(PathBuf, String)>,
}

pub fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

impl Installation {
    pub fn open(app: &Path) -> WalResult<Self> {
        let app = app.canonicalize()?;
        let info_bytes = fs::read(app.join("Contents/Info.plist"))?;
        let info = plist::Value::from_reader(std::io::Cursor::new(&info_bytes))
            .map_err(|error| WalError::Message(format!("读取飞书版本失败: {error}")))?;
        let bundle_id = info
            .as_dictionary()
            .and_then(|dict| dict.get("CFBundleIdentifier"))
            .and_then(plist::Value::as_string);
        if bundle_id != Some("com.electron.lark") {
            return Err(WalError::Message("所选应用不是飞书".into()));
        }
        let resources = app
            .join("Contents/Frameworks/Lark Framework.framework/Versions/Current/Resources")
            .canonicalize()?;
        if !resources.starts_with(&app) || !resources.join("webcontent").is_dir() {
            return Err(WalError::Message("飞书资源目录不受支持".into()));
        }
        let mut stamps = vec![(app.join("Contents/Info.plist"), sha256(&info_bytes))];
        let mut identity = info_bytes;
        identity.extend_from_slice(
            resources
                .strip_prefix(&app)
                .unwrap()
                .as_os_str()
                .as_encoded_bytes(),
        );
        // Detect same-version reinstalls with a different resource seal as well.
        let seal = resources
            .parent()
            .unwrap()
            .join("_CodeSignature/CodeResources");
        if seal.exists() {
            let bytes = fs::read(&seal)?;
            stamps.push((seal, sha256(&bytes)));
            identity.extend_from_slice(&bytes);
        }
        Ok(Self {
            app,
            resources,
            fingerprint: sha256(&identity),
            stamps,
        })
    }

    pub fn check_unchanged(&self) -> WalResult<()> {
        let current = Self::open(&self.app)?;
        if current.fingerprint != self.fingerprint || current.resources != self.resources {
            return Err(WalError::Message("飞书版本已变化，请重新应用主题".into()));
        }
        Ok(())
    }

    pub fn archive(&self, relative: &str) -> WalResult<PathBuf> {
        let normalized = relative.replace('\\', "/");
        let relative = Path::new(&normalized);
        if relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
            || relative.extension().and_then(|ext| ext.to_str()) != Some("asar")
        {
            return Err(WalError::Message("主题中的 ASAR 路径无效".into()));
        }
        let path =
            self.resources.join(relative).canonicalize().map_err(|_| {
                WalError::Message(format!("当前飞书版本没有资源文件: {normalized}"))
            })?;
        self.validate_archive(&path)?;
        Ok(path)
    }

    pub fn validate_archive(&self, path: &Path) -> WalResult<()> {
        if path.canonicalize()? != path
            || !path.starts_with(&self.resources)
            || path.extension().and_then(|value| value.to_str()) != Some("asar")
            || !path.is_file()
        {
            return Err(WalError::Message("ASAR 文件不在当前飞书资源目录中".into()));
        }
        Ok(())
    }
}

pub fn locate() -> WalResult<PathBuf> {
    let mut directories = vec![PathBuf::from("/Applications")];
    if let Some(home) = env::var_os("HOME") {
        directories.push(PathBuf::from(home).join("Applications"));
    }
    for directory in directories {
        for name in ["Lark.app", "Feishu.app", "飞书.app"] {
            let app = directory.join(name);
            if let Ok(installation) = Installation::open(&app) {
                return Ok(installation.app);
            }
        }
    }
    let output = Command::new("/usr/bin/mdfind")
        .args(["kMDItemCFBundleIdentifier == 'com.electron.lark'"])
        .output()?;
    for path in String::from_utf8_lossy(&output.stdout).lines() {
        if !matches!(
            Path::new(path).file_name().and_then(|name| name.to_str()),
            Some("Lark.app" | "Feishu.app" | "飞书.app")
        ) {
            continue;
        }
        if let Ok(installation) = Installation::open(Path::new(path)) {
            return Ok(installation.app);
        }
    }
    Err(WalError::Message(
        "未找到飞书，请将飞书安装到「应用程序」目录".into(),
    ))
}
