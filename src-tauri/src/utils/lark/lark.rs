use std::sync::Arc;

use crate::utils::lark::patch::LarkPatch;

pub struct Lark {
    path: Option<String>,
    patcher: Option<Arc<LarkPatch>>,
}

impl Lark {
    pub fn new() -> Self {
        Self {
            path: None,
            patcher: None,
        }
    }

    pub fn set_path(&mut self, path: &String) {
        self.path = Some(path.clone());
    }

    pub fn get_path(&self) -> Option<String> {
        self.path.clone()
    }

    pub fn set_patcher(&mut self, patcher: LarkPatch) {
        self.patcher = Some(Arc::new(patcher));
    }

    pub fn get_patcher(&self) -> Option<Arc<LarkPatch>> {
        self.patcher.clone()
    }
}
