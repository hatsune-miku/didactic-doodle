use std::sync::{LazyLock, Mutex};

use crate::utils::lark::lark::Lark;

pub static LARK_HELPER: LazyLock<Mutex<Lark>> = LazyLock::new(|| Mutex::new(Lark::new()));
