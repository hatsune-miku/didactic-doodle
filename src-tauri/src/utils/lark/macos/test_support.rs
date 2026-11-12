use std::{fs, path::PathBuf};

use super::installation::Installation;

pub struct Fixture {
    pub directory: tempfile::TempDir,
    pub installation: Installation,
    pub backups: PathBuf,
}

impl Fixture {
    pub fn new() -> Self {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().canonicalize().unwrap();
        // Exercise shell quoting without letting these characters become code.
        let app = root.join("飞书 test '$() `literal`.app");
        let versions = app.join("Contents/Frameworks/Lark Framework.framework/Versions");
        fs::create_dir_all(versions.join("1/Resources/webcontent")).unwrap();
        std::os::unix::fs::symlink("1", versions.join("Current")).unwrap();
        fs::write(app.join("Contents/Info.plist"), b"<?xml version=\"1.0\"?><plist version=\"1.0\"><dict><key>CFBundleIdentifier</key><string>com.electron.lark</string><key>CFBundleVersion</key><string>1</string></dict></plist>").unwrap();
        let installation = Installation::open(&app).unwrap();
        Self {
            directory,
            installation,
            backups: root.join("backups"),
        }
    }

    pub fn archive(&self, name: &str, data: &[u8]) -> PathBuf {
        let path = self.installation.resources.join(name);
        fs::write(&path, data).unwrap();
        path
    }

    pub fn update_version(&self) {
        let path = self.installation.app.join("Contents/Info.plist");
        let text = fs::read_to_string(&path)
            .unwrap()
            .replace("<string>1</string>", "<string>2</string>");
        fs::write(path, text).unwrap();
    }
}
