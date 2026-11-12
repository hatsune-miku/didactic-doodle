use windows_sys::Win32::{
    Foundation::{CloseHandle, INVALID_HANDLE_VALUE},
    System::{
        Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        },
        Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE},
    },
};

use crate::{error::WalResult, utils::platform::os::wide_to_string_utf16};

pub fn enum_processes<F>(process_name: &str, mut callback: F) -> WalResult<usize>
where
    F: FnMut(&PROCESSENTRY32W) -> bool,
{
    let process_name = process_name.to_lowercase();
    let mut count: usize = 0;

    unsafe {
        let h_snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if h_snapshot == INVALID_HANDLE_VALUE {
            return Err(std::io::Error::last_os_error().into());
        }
        let mut pe32 = PROCESSENTRY32W::default();
        pe32.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        let first = Process32FirstW(h_snapshot, &mut pe32);
        if first == 0 {
            let error = std::io::Error::last_os_error();
            CloseHandle(h_snapshot);
            return Err(error.into());
        }
        loop {
            let exe_file = wide_to_string_utf16(&pe32.szExeFile).to_lowercase();
            if process_name == exe_file {
                count += 1;
                if !callback(&pe32) {
                    break;
                }
            }
            if Process32NextW(h_snapshot, &mut pe32) == 0 {
                break;
            }
        }
        CloseHandle(h_snapshot);
    }
    Ok(count)
}

pub fn is_process_running(process_name: &str) -> WalResult<bool> {
    Ok(enum_processes(process_name, |_| false)? > 0)
}

pub fn kill_all_processes(process_name: &str) -> WalResult<bool> {
    let mut all_killed = true;
    enum_processes(process_name, |pe32| unsafe {
        let h_process = OpenProcess(PROCESS_TERMINATE, 0, pe32.th32ProcessID);
        if h_process.is_null() {
            all_killed = false;
            return true;
        }
        if TerminateProcess(h_process, 0) == 0 {
            all_killed = false;
            CloseHandle(h_process);
            return true;
        }
        CloseHandle(h_process);
        true
    })?;
    Ok(all_killed)
}
