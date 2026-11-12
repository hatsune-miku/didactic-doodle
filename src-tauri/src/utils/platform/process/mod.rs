use std::path::Path;

use crate::error::{WalError, WalResult};

#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "windows")]
mod windows;

pub fn is_running(app: &Path) -> WalResult<bool> {
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        windows::is_process_running("Feishu.exe")
    }
    #[cfg(target_os = "macos")]
    {
        Ok(!macos::running_pids(app)?.is_empty())
    }
}

pub fn require_stopped(app: &Path) -> WalResult<()> {
    if is_running(app)? {
        return Err(WalError::Message("飞书正在运行，请先关闭".into()));
    }
    Ok(())
}

pub fn kill(app: &Path) -> WalResult<()> {
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        if windows::kill_all_processes("Feishu.exe")? {
            Ok(())
        } else {
            Err(WalError::Message("部分飞书进程未能结束".into()))
        }
    }
    #[cfg(target_os = "macos")]
    {
        macos::kill(app)
    }
}

pub fn launch(app: &Path) -> WalResult<()> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new(app.join("Feishu.exe")).spawn()?;
    }
    #[cfg(target_os = "macos")]
    {
        checked_output(
            std::process::Command::new("/usr/bin/open")
                .arg("-a")
                .arg(app),
        )?;
    }
    Ok(())
}

pub fn reveal(app: &Path) -> WalResult<()> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(app)
            .spawn()?;
    }
    #[cfg(target_os = "macos")]
    {
        checked_output(
            std::process::Command::new("/usr/bin/open")
                .arg("-R")
                .arg(app),
        )?;
    }
    Ok(())
}

pub fn checked_output(command: &mut std::process::Command) -> WalResult<std::process::Output> {
    let output = command.output()?;
    if !output.status.success() {
        return Err(WalError::Message(
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ));
    }
    Ok(output)
}
