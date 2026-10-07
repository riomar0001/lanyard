//! Owns the sidecar child process (Node running out/sidecar/index.js) and the
//! request/response plumbing over its stdio. Requests are matched to responses
//! by id through a pending map; unsolicited lines (no id) are events and are
//! re-emitted to the webview on their original channel names.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use tauri::{AppHandle, Emitter};

const CALL_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(120);

type PendingMap = Arc<Mutex<HashMap<u64, mpsc::Sender<Value>>>>;

pub struct Sidecar {
    _child: Child,
    stdin: Mutex<ChildStdin>,
    pending: PendingMap,
    next_id: AtomicU64,
}

impl Sidecar {
    pub fn spawn(
        app: AppHandle,
        program: &str,
        script: &str,
        extra_env: &[(&str, &str)],
    ) -> std::io::Result<Arc<Self>> {
        let mut cmd = Command::new(program);
        cmd.arg(script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit());
        // node.exe is a console program: without this, Windows opens a console
        // window for it next to the (windowless-subsystem) app.
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        for (k, v) in extra_env {
            cmd.env(k, v);
        }
        let mut child = cmd.spawn()?;
        let stdin = child.stdin.take().expect("stdin piped");
        let stdout = child.stdout.take().expect("stdout piped");

        let pending: PendingMap = Arc::new(Mutex::new(HashMap::new()));
        let reader_pending = Arc::clone(&pending);
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                let Ok(v) = serde_json::from_str::<Value>(&line) else {
                    continue;
                };
                if let Some(id) = v.get("id").and_then(Value::as_u64) {
                    let tx = reader_pending.lock().unwrap().remove(&id);
                    if let Some(tx) = tx {
                        let _ = tx.send(v);
                    }
                } else if let (Some(event), Some(payload)) =
                    (v.get("event").and_then(Value::as_str), v.get("payload"))
                {
                    let _ = app.emit(event, payload.clone());
                }
            }
        });

        Ok(Arc::new(Self {
            _child: child,
            stdin: Mutex::new(stdin),
            pending,
            next_id: AtomicU64::new(1),
        }))
    }

    pub fn call(&self, namespace: &str, method: &str, args: Value) -> Value {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = mpsc::channel::<Value>();
        self.pending.lock().unwrap().insert(id, tx);
        let req = json!({ "id": id, "namespace": namespace, "method": method, "args": args });
        if writeln!(self.stdin.lock().unwrap(), "{}", req).is_err() {
            self.pending.lock().unwrap().remove(&id);
            return json!({ "ok": false, "error": "sidecar is not running" });
        }
        match rx.recv_timeout(CALL_TIMEOUT) {
            Ok(v) => v,
            Err(_) => {
                self.pending.lock().unwrap().remove(&id);
                json!({ "ok": false, "error": format!("sidecar timeout on {namespace}.{method}") })
            }
        }
    }
}
