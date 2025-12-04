use std::sync::{LazyLock, Mutex, MutexGuard};

use crate::{
    error::{WalError, WalResult},
    utils::lark::lark::Lark,
};

pub static LARK_HELPER: LazyLock<Mutex<Lark>> = LazyLock::new(|| Mutex::new(Lark::new()));

pub trait IntoLarkSessionResult<T> {
    fn into_lark_session_result(self) -> WalResult<T>;
}

pub fn get_lark_helper<'a>() -> WalResult<MutexGuard<'a, Lark>> {
    LARK_HELPER.lock().map_err(|_| WalError::LockError)
}

pub fn lark_helper_session<T>(f: impl FnOnce(&mut Lark) -> WalResult<T>) -> WalResult<T> {
    match get_lark_helper() {
        Ok(mut helper) => f(&mut helper),
        Err(e) => Err(e),
    }
}
